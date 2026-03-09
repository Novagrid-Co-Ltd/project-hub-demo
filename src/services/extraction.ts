import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { generateAndParse } from "./gemini.js";
import { buildExtractionPrompt, EXTRACTION_PROMPT_VERSION } from "../prompts/extraction-prompt.js";
import type { ProjectContext } from "../prompts/extraction-prompt.js";
import type { ExtractionResult, ExtractionResultItem, ExtractedItem, AiOriginal } from "../types/extracted-item.js";
import { ensureMeetingProjectLinks } from "./project-matcher.js";
import { logger } from "../utils/logger.js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const cfg = getConfig();
    _supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
  }
  return _supabase;
}

const VALID_TYPES = new Set(["todo", "decision", "issue", "phase_change"]);
const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

/**
 * PJのコンテキスト情報（メンバー名・role、フェーズ名・status）を取得
 */
async function getProjectContext(projectId: string): Promise<ProjectContext & { id: string; memberNameToId: Map<string, string> }> {
  const { data: project } = await getSupabase()
    .from("pjhub_projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error(`Project not found: ${projectId}`);

  // メンバー取得
  const { data: pm } = await getSupabase()
    .from("pjhub_project_members")
    .select("member_id, role, mst_person_identity(display_name)")
    .eq("project_id", projectId);

  const memberNameToId = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (pm ?? []).map((r: any) => {
    const mpi = r.mst_person_identity;
    const name = Array.isArray(mpi) ? mpi[0]?.display_name ?? "" : mpi?.display_name ?? "";
    if (name) memberNameToId.set(name, r.member_id);
    return { name, role: r.role ?? "" };
  }).filter((m: { name: string }) => m.name);

  // フェーズ取得
  const { data: phases } = await getSupabase()
    .from("pjhub_phases")
    .select("id, name, status")
    .eq("project_id", projectId)
    .order("sort_order");

  return {
    id: project.id,
    name: project.name,
    members,
    phases: (phases ?? []).map((p: { name: string; status: string }) => ({ name: p.name, status: p.status })),
    memberNameToId,
  };
}

/**
 * Geminiレスポンスのバリデーション
 */
function validateExtractionResult(
  result: ExtractionResult,
  memberNames: Set<string>,
  phaseNames: Set<string>,
): ExtractionResult {
  const validItems: ExtractionResultItem[] = [];

  for (const item of result.items ?? []) {
    // type チェック
    if (!VALID_TYPES.has(item.type)) {
      logger.warn("Invalid item type, skipping", { type: item.type, content: item.content });
      continue;
    }
    // content チェック
    if (!item.content || item.content.trim().length === 0) {
      logger.warn("Empty item content, skipping");
      continue;
    }
    // priority 正規化
    if (!VALID_PRIORITIES.has(item.priority)) {
      item.priority = "medium";
    }
    // assignee 検証: メンバー一覧にない名前は null に
    if (item.assignee && !memberNames.has(item.assignee)) {
      logger.warn("Assignee not in member list, setting to null", { assignee: item.assignee });
      item.assignee = null;
    }
    // phase_change の場合: phase名検証
    if (item.type === "phase_change") {
      if (item.phase_completed && !phaseNames.has(item.phase_completed)) {
        logger.warn("phase_completed not found in phases, setting to null", { phase_completed: item.phase_completed });
        item.phase_completed = null;
      }
      if (item.phase_started && !phaseNames.has(item.phase_started)) {
        logger.warn("phase_started not found in phases, setting to null", { phase_started: item.phase_started });
        item.phase_started = null;
      }
    }

    validItems.push(item);
  }

  return { items: validItems, milestones: result.milestones ?? [] };
}

/**
 * 指定会議のPJ紐付きの抽出を実行
 */
export async function extractForMeeting(meetingId: string): Promise<{
  items: ExtractedItem[];
  milestoneCount: number;
  projectIds: string[];
}> {
  // 1. 議事録テキスト取得（event_startも取得）
  const { data: meeting, error: meetingError } = await getSupabase()
    .from("eval_meeting_raw")
    .select("id, transcript, event_summary, event_start")
    .eq("id", meetingId)
    .single();

  if (meetingError || !meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  if (!meeting.transcript || meeting.transcript.trim().length === 0) {
    logger.warn("Meeting has no transcript, skipping extraction", { meetingId });
    return { items: [], milestoneCount: 0, projectIds: [] };
  }

  // 会議日付をYYYY-MM-DD形式に変換
  const meetingDate = meeting.event_start
    ? new Date(meeting.event_start).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // 2. PJ紐付けを確認（なければマッチング試行）
  const projectIds = await ensureMeetingProjectLinks(meetingId);

  if (projectIds.length === 0) {
    logger.info("No project linked to meeting, skipping extraction", { meetingId });
    return { items: [], milestoneCount: 0, projectIds: [] };
  }

  logger.info("Extracting for meeting", { meetingId, meetingDate, projectCount: projectIds.length, promptVersion: EXTRACTION_PROMPT_VERSION });

  const allItems: ExtractedItem[] = [];
  let totalMilestoneCount = 0;

  // 3. 紐づくPJごとに抽出
  for (const projectId of projectIds) {
    try {
      const ctx = await getProjectContext(projectId);

      // プロンプト生成（会議日付を渡す）
      const prompt = buildExtractionPrompt(meeting.transcript, {
        name: ctx.name,
        members: ctx.members,
        phases: ctx.phases,
      }, meetingDate);

      // Gemini呼び出し（generateAndParse内部でリトライ1回あり）
      const { parsed, raw } = await generateAndParse<ExtractionResult>(prompt);

      if (!parsed) {
        logger.error("Extraction failed: could not parse LLM response", { meetingId, projectId, raw });
        continue;
      }

      // バリデーション
      const memberNames = new Set(ctx.members.map((m) => m.name));
      const phaseNames = new Set(ctx.phases.map((p) => p.name));
      const validated = validateExtractionResult(parsed, memberNames, phaseNames);

      logger.info("Extraction completed for project", {
        meetingId,
        projectId,
        projectName: ctx.name,
        itemCount: validated.items.length,
        milestoneCount: validated.milestones.length,
      });

      // 4. items → extracted_items テーブルに INSERT
      if (validated.items.length > 0) {
        const itemsToInsert: Omit<ExtractedItem, "id" | "created_at" | "updated_at">[] = validated.items.map((item) => {
          const aiOriginal: AiOriginal = {
            content: item.content,
            assignee: item.assignee,
            due_date: item.due_date,
            priority: item.priority,
            source_quote: item.source_quote,
          };
          if (item.type === "phase_change") {
            aiOriginal.phase_completed = item.phase_completed ?? undefined;
            aiOriginal.phase_started = item.phase_started ?? undefined;
          }

          // assignee名 → member_id 解決
          const assigneeMemberId = item.assignee ? ctx.memberNameToId.get(item.assignee) ?? null : null;

          return {
            meeting_id: meetingId,
            project_id: projectId,
            type: item.type,
            status: "draft" as const,
            ai_original: aiOriginal,
            content: item.content,
            assignee_member_id: assigneeMemberId,
            due_date: item.due_date,
            priority: item.priority,
            confirmed_at: null,
            confirmed_by: null,
          };
        });

        const { data: inserted, error: insertError } = await getSupabase()
          .from("pjhub_extracted_items")
          .insert(itemsToInsert)
          .select();

        if (insertError) {
          logger.error("Failed to insert extracted items", { meetingId, projectId, error: insertError.message });
        } else {
          allItems.push(...((inserted ?? []) as ExtractedItem[]));
        }
      }

      // 5. milestones → milestones テーブルに INSERT
      if (validated.milestones.length > 0) {
        // フェーズ名→IDの解決
        const { data: phasesWithId } = await getSupabase()
          .from("pjhub_phases")
          .select("id, name")
          .eq("project_id", projectId);

        const phaseNameToId = new Map<string, string>();
        for (const p of phasesWithId ?? []) {
          phaseNameToId.set(p.name, p.id);
        }

        const milestonesToInsert = validated.milestones.map((ms) => ({
          project_id: projectId,
          phase_id: ms.phase_name ? phaseNameToId.get(ms.phase_name) ?? null : null,
          name: ms.name,
          due_date: ms.due_date,
          status: "pending" as const,
          source: "ai" as const,
          source_meeting_id: meetingId,
        }));

        const { error: msError } = await getSupabase()
          .from("pjhub_milestones")
          .insert(milestonesToInsert);

        if (msError) {
          logger.error("Failed to insert milestones", { meetingId, projectId, error: msError.message });
        } else {
          totalMilestoneCount += milestonesToInsert.length;
        }
      }
    } catch (err) {
      logger.error("Extraction failed for project", {
        meetingId,
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("Extraction done for meeting", {
    meetingId,
    totalItems: allItems.length,
    totalMilestones: totalMilestoneCount,
    projectIds,
  });

  return { items: allItems, milestoneCount: totalMilestoneCount, projectIds };
}

/**
 * 未抽出の会議を一括抽出する
 */
export async function extractBatch(): Promise<{
  results: { meetingId: string; itemCount: number; milestoneCount: number; status: "success" | "skipped" | "error" }[];
  summary: { total: number; succeeded: number; skipped: number; failed: number };
}> {
  // extracted_items に存在しない会議を取得
  const { data: allMeetings } = await getSupabase()
    .from("eval_meeting_raw")
    .select("id")
    .order("created_at", { ascending: false });

  const { data: extractedMeetingIds } = await getSupabase()
    .from("pjhub_extracted_items")
    .select("meeting_id");

  const extractedSet = new Set((extractedMeetingIds ?? []).map((e: { meeting_id: string }) => e.meeting_id));
  const unextracted = (allMeetings ?? []).filter((m: { id: string }) => !extractedSet.has(m.id));

  logger.info("Batch extraction started", { total: allMeetings?.length, unextracted: unextracted.length });

  const results: { meetingId: string; itemCount: number; milestoneCount: number; status: "success" | "skipped" | "error" }[] = [];

  for (const meeting of unextracted) {
    try {
      const result = await extractForMeeting(meeting.id);
      if (result.projectIds.length === 0) {
        results.push({ meetingId: meeting.id, itemCount: 0, milestoneCount: 0, status: "skipped" });
      } else {
        results.push({ meetingId: meeting.id, itemCount: result.items.length, milestoneCount: result.milestoneCount, status: "success" });
      }
    } catch (err) {
      logger.error("Batch extraction failed for meeting", {
        meetingId: meeting.id,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ meetingId: meeting.id, itemCount: 0, milestoneCount: 0, status: "error" });
    }
  }

  const summary = {
    total: results.length,
    succeeded: results.filter((r) => r.status === "success").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "error").length,
  };

  logger.info("Batch extraction completed", summary);
  return { results, summary };
}
