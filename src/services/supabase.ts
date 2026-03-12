import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import type { RowMeetingRaw, TfMeetingAttendee, TfIndividualScoreInput, MasterPersonIdentity } from "../types/meeting.js";
import type { OutMeetingEval, OutIndividualEval } from "../types/evaluation.js";
import { logger } from "../utils/logger.js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const cfg = getConfig();
    _supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
  }
  return _supabase;
}

// --- eval_meeting_raw ---

export async function upsertRowData(row: RowMeetingRaw): Promise<RowMeetingRaw> {
  const { data, error } = await getSupabase()
    .from("eval_meeting_raw")
    .upsert(row, { onConflict: "meet_instance_key" })
    .select()
    .single();
  if (error) throw error;
  logger.info("Upserted eval_meeting_raw", { meet_instance_key: row.meet_instance_key });
  return data as RowMeetingRaw;
}

// --- eval_meeting_attendee ---

export async function upsertAttendees(meetInstanceKey: string, attendees: TfMeetingAttendee[]): Promise<void> {
  const rows = attendees.map((a) => ({ ...a, meet_instance_key: meetInstanceKey }));
  const { error } = await getSupabase()
    .from("eval_meeting_attendee")
    .upsert(rows, { onConflict: "meet_instance_key,email" });
  if (error) throw error;
  logger.info("Upserted eval_meeting_attendee", { meetInstanceKey, count: attendees.length });
}

// --- eval_individual_input ---

export async function upsertIndividualInputs(inputs: TfIndividualScoreInput[]): Promise<void> {
  const { error } = await getSupabase()
    .from("eval_individual_input")
    .upsert(inputs, { onConflict: "meet_instance_key,email" });
  if (error) throw error;
  logger.info("Upserted eval_individual_input", { count: inputs.length });
}

// --- eval_meeting_score ---

export async function upsertMeetingEval(evalData: OutMeetingEval): Promise<void> {
  const { error } = await getSupabase()
    .from("eval_meeting_score")
    .upsert(evalData, { onConflict: "meet_instance_key" });
  if (error) throw error;
  logger.info("Upserted eval_meeting_score", { meet_instance_key: evalData.meet_instance_key });
}

// --- eval_individual_score ---

export async function upsertIndividualEval(evalData: OutIndividualEval): Promise<void> {
  const { error } = await getSupabase()
    .from("eval_individual_score")
    .upsert(evalData, { onConflict: "meet_instance_key,email" });
  if (error) throw error;
  logger.info("Upserted eval_individual_score", { meet_instance_key: evalData.meet_instance_key, email: evalData.email });
}

// --- mst_person_identity ---

export async function getPersonIdentities(): Promise<MasterPersonIdentity[]> {
  const { data, error } = await getSupabase()
    .from("mst_person_identity")
    .select("*");
  if (error) throw error;
  return (data ?? []) as MasterPersonIdentity[];
}

// --- debug: fetch meeting by key ---

export async function getMeetingByKey(meetInstanceKey: string) {
  const [row, attendees, meetingEval, individualEvals] = await Promise.all([
    getSupabase().from("eval_meeting_raw").select("*").eq("meet_instance_key", meetInstanceKey).single(),
    getSupabase().from("eval_meeting_attendee").select("*").eq("meet_instance_key", meetInstanceKey),
    getSupabase().from("eval_meeting_score").select("*").eq("meet_instance_key", meetInstanceKey).single(),
    getSupabase().from("eval_individual_score").select("*").eq("meet_instance_key", meetInstanceKey),
  ]);
  return {
    row: row.data,
    attendees: attendees.data,
    meetingEval: meetingEval.data,
    individualEvals: individualEvals.data,
  };
}
