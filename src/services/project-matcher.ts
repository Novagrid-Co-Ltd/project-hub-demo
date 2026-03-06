import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const cfg = getConfig();
    _supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
  }
  return _supabase;
}

export interface MatchResult {
  meetingId: string;
  matchedProjectIds: string[];
}

/**
 * event_summaryからPJ名を抽出する
 * 想定フォーマット: 【定例】PJ名@MEIM@MEII や 【定例】PJ名 など
 */
function extractProjectNameFromSummary(eventSummary: string): string | null {
  // 【...】の後ろのテキストを取得（@以降は除外）
  const match = eventSummary.match(/【[^】]*】\s*(.+?)(?:@|$)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * 会議タイトルとPJのcalendar_keywordsを照合し、マッチしたPJに紐付ける
 */
export async function matchMeetingToProjects(meetingId: string, meetingTitle: string): Promise<string[]> {
  const { data: projects } = await getSupabase()
    .from("projects")
    .select("id, name, calendar_keywords")
    .in("status", ["active", "on_hold"]);

  if (!projects || projects.length === 0) return [];

  const titleLower = meetingTitle.toLowerCase();
  const matchedIds: string[] = [];

  // 1. event_summary から PJ名を抽出してマッチング
  const extractedName = extractProjectNameFromSummary(meetingTitle);
  if (extractedName) {
    const extractedLower = extractedName.toLowerCase();
    for (const pj of projects) {
      if (pj.name.toLowerCase().includes(extractedLower) || extractedLower.includes(pj.name.toLowerCase())) {
        matchedIds.push(pj.id);
      }
    }
  }

  // 2. calendar_keywords でマッチング（従来ロジック）
  if (matchedIds.length === 0) {
    for (const pj of projects) {
      const keywords: string[] = pj.calendar_keywords ?? [];
      const matched = keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()));
      if (matched) {
        matchedIds.push(pj.id);
      }
    }
  }

  if (matchedIds.length === 0) return [];

  // 重複除去
  const uniqueIds = [...new Set(matchedIds)];

  // 既に紐付け済みのものを除外
  const { data: existing } = await getSupabase()
    .from("project_meetings")
    .select("project_id")
    .eq("meeting_id", meetingId);

  const existingSet = new Set((existing ?? []).map((e: { project_id: string }) => e.project_id));
  const newMatches = uniqueIds.filter((id) => !existingSet.has(id));

  if (newMatches.length > 0) {
    const rows = newMatches.map((projectId) => ({
      project_id: projectId,
      meeting_id: meetingId,
      matched_by: "ai" as const,
    }));

    const { error } = await getSupabase().from("project_meetings").insert(rows);

    if (error) {
      logger.error("Failed to insert project_meetings", { meetingId, error: error.message });
    } else {
      logger.info("Meeting matched to projects", { meetingId, projectIds: newMatches });
    }
  }

  // マッチした場合、row_meeting_raw.project_name を更新
  if (extractedName && uniqueIds.length > 0) {
    await getSupabase()
      .from("row_meeting_raw")
      .update({ project_name: extractedName })
      .eq("id", meetingId)
      .is("project_name", null);
  }

  return uniqueIds;
}

/**
 * 全未紐付け会議に対して一括でPJマッチングを実行
 */
export async function matchAllUnlinkedMeetings(): Promise<MatchResult[]> {
  // 全会議を取得
  const { data: allMeetings } = await getSupabase()
    .from("row_meeting_raw")
    .select("id, event_summary")
    .order("created_at", { ascending: false });

  if (!allMeetings || allMeetings.length === 0) return [];

  // 既に紐付け済みの会議IDを取得
  const { data: linkedRows } = await getSupabase()
    .from("project_meetings")
    .select("meeting_id");

  const linkedSet = new Set((linkedRows ?? []).map((r: { meeting_id: string }) => r.meeting_id));

  // 未紐付け会議をフィルタ
  const unlinked = allMeetings.filter(
    (m: { id: string; event_summary: string | null }) => !linkedSet.has(m.id) && m.event_summary
  );

  logger.info("Batch meeting matching started", { total: allMeetings.length, unlinked: unlinked.length });

  const results: MatchResult[] = [];

  for (const meeting of unlinked) {
    const matchedProjectIds = await matchMeetingToProjects(meeting.id, meeting.event_summary ?? "");
    results.push({ meetingId: meeting.id, matchedProjectIds });
  }

  const matched = results.filter((r) => r.matchedProjectIds.length > 0).length;
  logger.info("Batch meeting matching completed", { processed: results.length, matched });

  return results;
}

/**
 * 指定会議のPJ紐付けを取得。なければマッチングを試みる。
 * 戻り値: 紐付いたproject_id の配列
 */
export async function ensureMeetingProjectLinks(meetingId: string): Promise<string[]> {
  // 既存の紐付けを確認
  const { data: existing } = await getSupabase()
    .from("project_meetings")
    .select("project_id")
    .eq("meeting_id", meetingId);

  if (existing && existing.length > 0) {
    return existing.map((e: { project_id: string }) => e.project_id);
  }

  // 紐付けがないので会議タイトルを取得してマッチングを試みる
  const { data: meeting } = await getSupabase()
    .from("row_meeting_raw")
    .select("event_summary")
    .eq("id", meetingId)
    .single();

  if (!meeting?.event_summary) return [];

  return matchMeetingToProjects(meetingId, meeting.event_summary);
}
