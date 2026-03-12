import type { TfIndividualScoreInput } from "../types/meeting.js";
import type { OutIndividualEval, DynamicIndividualResponse } from "../types/evaluation.js";
import type { ScoringCriteria } from "../types/scoring-criteria.js";
import type { CriteriaSnapshot } from "../types/scoring-criteria.js";
import { generateAndParse } from "../services/gemini.js";
import { upsertIndividualEval } from "../services/supabase.js";
import { getActiveCriteria, buildCriteriaSnapshot } from "../services/scoring-criteria.js";
import { buildDynamicIndividualEvalPrompt, DYNAMIC_INDIVIDUAL_PROMPT_VERSION } from "../prompts/dynamicIndividualEval.js";
import { logger } from "../utils/logger.js";

async function runOne(
  input: TfIndividualScoreInput,
  criteria: ScoringCriteria[],
  snapshot: CriteriaSnapshot,
): Promise<OutIndividualEval> {
  const prompt = buildDynamicIndividualEvalPrompt(criteria, {
    displayName: input.display_name,
    email: input.email,
    eventSummary: input.event_summary,
    eventStart: input.event_start,
    eventEnd: input.event_end,
    attendeeCount: input.attendee_count,
    transcript: input.transcript,
  });

  const { parsed, raw } = await generateAndParse<DynamicIndividualResponse>(prompt);

  let evalData: OutIndividualEval;

  if (parsed) {
    const dynamicScores = parsed.scores;

    evalData = {
      meet_instance_key: input.meet_instance_key,
      email: input.email,
      evaluation_status: "success",
      prompt_version: DYNAMIC_INDIVIDUAL_PROMPT_VERSION,
      // Legacy columns — dual-write for backward compatibility
      issue_comprehension: dynamicScores["issue_comprehension"] ?? null,
      value_density: dynamicScores["value_density"] ?? null,
      structured_thinking: dynamicScores["structured_thinking"] ?? null,
      collaborative_influence: dynamicScores["collaborative_influence"] ?? null,
      decision_drive: dynamicScores["decision_drive"] ?? null,
      execution_linkage: dynamicScores["execution_linkage"] ?? null,
      // Qualitative fields
      evidence_quotes: parsed.evidence.quotes,
      evidence_notes: parsed.evidence.notes,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      communication_style: parsed.communication_style,
      summary: parsed.summary,
      raw_response: raw,
      // Dynamic JSONB fields
      scores: dynamicScores,
      criteria_snapshot: snapshot,
    };
  } else {
    logger.error("Individual evaluation failed", {
      meet_instance_key: input.meet_instance_key,
      email: input.email,
    });
    evalData = {
      meet_instance_key: input.meet_instance_key,
      email: input.email,
      evaluation_status: "failed",
      prompt_version: DYNAMIC_INDIVIDUAL_PROMPT_VERSION,
      issue_comprehension: null,
      value_density: null,
      structured_thinking: null,
      collaborative_influence: null,
      decision_drive: null,
      execution_linkage: null,
      evidence_quotes: null,
      evidence_notes: null,
      strengths: null,
      improvements: null,
      communication_style: null,
      summary: null,
      raw_response: raw,
      scores: null,
      criteria_snapshot: snapshot,
    };
  }

  await upsertIndividualEval(evalData);
  return evalData;
}

export async function runAll(inputs: TfIndividualScoreInput[]): Promise<OutIndividualEval[]> {
  // Fetch criteria once for all participants
  const criteria = await getActiveCriteria("individual");
  const snapshot = buildCriteriaSnapshot(criteria);

  const results: OutIndividualEval[] = [];

  // Sequential execution — do not parallelize
  for (const input of inputs) {
    try {
      const result = await runOne(input, criteria, snapshot);
      results.push(result);
    } catch (err) {
      logger.error("Individual eval error, continuing to next participant", {
        email: input.email,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        meet_instance_key: input.meet_instance_key,
        email: input.email,
        evaluation_status: "failed",
        prompt_version: DYNAMIC_INDIVIDUAL_PROMPT_VERSION,
        issue_comprehension: null,
        value_density: null,
        structured_thinking: null,
        collaborative_influence: null,
        decision_drive: null,
        execution_linkage: null,
        evidence_quotes: null,
        evidence_notes: null,
        strengths: null,
        improvements: null,
        communication_style: null,
        summary: null,
        raw_response: null,
        scores: null,
        criteria_snapshot: snapshot,
      });
    }
  }

  return results;
}
