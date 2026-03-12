import type { RowMeetingRaw } from "../types/meeting.js";
import type { OutMeetingEval, DynamicMeetingResponse } from "../types/evaluation.js";
import type { ScoringCriteria } from "../types/scoring-criteria.js";
import { generateAndParse } from "../services/gemini.js";
import { upsertMeetingEval } from "../services/supabase.js";
import { getActiveCriteria, buildCriteriaSnapshot } from "../services/scoring-criteria.js";
import { buildDynamicMeetingEvalPrompt, DYNAMIC_PROMPT_VERSION } from "../prompts/dynamicMeetingEval.js";
import { logger } from "../utils/logger.js";

// Legacy axis keys for dual-write
const LEGACY_MEETING_AXES = [
  "goal_clarity", "decision_made", "todo_clarity",
  "role_clarity", "time_efficiency", "participation_balance",
] as const;

export async function run(rowData: RowMeetingRaw): Promise<OutMeetingEval> {
  // Fetch active criteria dynamically
  const criteria = await getActiveCriteria("meeting");
  const snapshot = buildCriteriaSnapshot(criteria);

  const prompt = buildDynamicMeetingEvalPrompt(criteria, {
    eventSummary: rowData.event_summary,
    eventStart: rowData.event_start,
    eventEnd: rowData.event_end,
    attendeeCount: rowData.attendee_count,
    charCount: rowData.char_count,
    transcript: rowData.transcript,
  });

  const { parsed, raw } = await generateAndParse<DynamicMeetingResponse>(prompt);

  let evalData: OutMeetingEval;

  if (parsed) {
    const dynamicScores = parsed.summary_scores;

    // Build base eval data with JSONB scores
    evalData = {
      meet_instance_key: rowData.meet_instance_key,
      evaluation_status: "success",
      prompt_version: DYNAMIC_PROMPT_VERSION,
      // Legacy columns — dual-write for backward compatibility
      goal_clarity: dynamicScores["goal_clarity"] ?? null,
      decision_made: dynamicScores["decision_made"] ?? null,
      todo_clarity: dynamicScores["todo_clarity"] ?? null,
      role_clarity: dynamicScores["role_clarity"] ?? null,
      time_efficiency: dynamicScores["time_efficiency"] ?? null,
      participation_balance: dynamicScores["participation_balance"] ?? null,
      // Qualitative fields (unchanged)
      headline: parsed.human_summary.headline,
      overall_assessment: parsed.human_summary.overall_assessment,
      key_topics: parsed.human_summary.key_topics,
      strength_axis: parsed.human_summary.strength_axis,
      strength_reason: parsed.human_summary.strength_reason,
      weakness_axis: parsed.human_summary.weakness_axis,
      weakness_reason: parsed.human_summary.weakness_reason,
      special_notes: parsed.human_summary.special_notes,
      decisions: parsed.human_summary.decisions,
      action_items: parsed.human_summary.action_items,
      recommendations: parsed.human_summary.recommendations,
      participation_note: parsed.human_summary.participation_note,
      raw_response: raw,
      // Dynamic JSONB fields
      scores: dynamicScores,
      criteria_snapshot: snapshot,
    };
  } else {
    logger.error("Meeting evaluation failed: could not parse LLM response", {
      meet_instance_key: rowData.meet_instance_key,
    });
    evalData = {
      meet_instance_key: rowData.meet_instance_key,
      evaluation_status: "failed",
      prompt_version: DYNAMIC_PROMPT_VERSION,
      goal_clarity: null,
      decision_made: null,
      todo_clarity: null,
      role_clarity: null,
      time_efficiency: null,
      participation_balance: null,
      headline: null,
      overall_assessment: null,
      key_topics: null,
      strength_axis: null,
      strength_reason: null,
      weakness_axis: null,
      weakness_reason: null,
      special_notes: null,
      decisions: null,
      action_items: null,
      recommendations: null,
      participation_note: null,
      raw_response: raw,
      scores: null,
      criteria_snapshot: snapshot,
    };
  }

  await upsertMeetingEval(evalData);
  return evalData;
}
