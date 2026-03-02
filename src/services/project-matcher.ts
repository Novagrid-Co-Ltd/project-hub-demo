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
 * 会議タイトルとPJのcalendar_keywordsを照合し、マッチしたPJに紐付ける
 */
export async function matchMeetingToProjects(meetingId: string, meetingTitle: string): Promise<string[]> {
  const { data: projects } = await getSupabase()
    .from("projects")
    .select("id, calendar_keywords")
    .in("status", ["active", "on_hold"]);

  if (!projects || projects.length === 0) return [];

  const titleLower = meetingTitle.toLowerCase();
  const matchedIds: string[] = [];

  for (const pj of projects) {
    const keywords: string[] = pj.calendar_keywords ?? [];
    const matched = keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()));
    if (matched) {
      matchedIds.push(pj.id);
    }
  }

  if (matchedIds.length === 0) return [];

  // 既に紐付け済みのものを除外
  const { data: existing } = await getSupabase()
    .from("project_meetings")
    .select("project_id")
    .eq("meeting_id", meetingId);

  const existingSet = new Set((existing ?? []).map((e: { project_id: string }) => e.project_id));
  const newMatches = matchedIds.filter((id) => !existingSet.has(id));

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

  return matchedIds;
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
