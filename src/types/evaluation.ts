import type { CriteriaSnapshot, DynamicScores } from "./scoring-criteria.js";

export interface GeminiMeetingResponse {
  summary_scores: {
    goal_clarity: number;
    decision_made: number;
    todo_clarity: number;
    role_clarity: number;
    time_efficiency: number;
    participation_balance: number;
  };
  human_summary: {
    headline: string;
    overall_assessment: string;
    key_topics: string[];
    strength_axis: string;
    strength_reason: string;
    weakness_axis: string;
    weakness_reason: string;
    special_notes: string[];
    decisions: string[];
    action_items: string[];
    recommendations: string[];
    participation_note: string;
  };
}

export interface DynamicMeetingResponse {
  summary_scores: DynamicScores;
  human_summary: {
    headline: string;
    overall_assessment: string;
    key_topics: string[];
    strength_axis: string;
    strength_reason: string;
    weakness_axis: string;
    weakness_reason: string;
    special_notes: string[];
    decisions: string[];
    action_items: string[];
    recommendations: string[];
    participation_note: string;
  };
}

export interface GeminiIndividualResponse {
  scores: {
    issue_comprehension: number;
    value_density: number;
    structured_thinking: number;
    collaborative_influence: number;
    decision_drive: number;
    execution_linkage: number;
  };
  evidence: {
    quotes: string[];
    notes: string[];
  };
  strengths: string[];
  improvements: string[];
  communication_style: string;
  summary: string;
}

export interface DynamicIndividualResponse {
  scores: DynamicScores;
  evidence: {
    quotes: string[];
    notes: string[];
  };
  strengths: string[];
  improvements: string[];
  communication_style: string;
  summary: string;
}

export interface OutMeetingEval {
  id?: string;
  meet_instance_key: string;
  evaluation_status: "success" | "failed";
  prompt_version: string;
  goal_clarity: number | null;
  decision_made: number | null;
  todo_clarity: number | null;
  role_clarity: number | null;
  time_efficiency: number | null;
  participation_balance: number | null;
  headline: string | null;
  overall_assessment: string | null;
  key_topics: string[] | null;
  strength_axis: string | null;
  strength_reason: string | null;
  weakness_axis: string | null;
  weakness_reason: string | null;
  special_notes: string[] | null;
  decisions: string[] | null;
  action_items: string[] | null;
  recommendations: string[] | null;
  participation_note: string | null;
  raw_response: string | null;
  scores?: DynamicScores | null;
  criteria_snapshot?: CriteriaSnapshot | null;
  created_at?: string;
  updated_at?: string;
}

export interface OutIndividualEval {
  id?: string;
  meet_instance_key: string;
  email: string;
  evaluation_status: "success" | "failed";
  prompt_version: string;
  issue_comprehension: number | null;
  value_density: number | null;
  structured_thinking: number | null;
  collaborative_influence: number | null;
  decision_drive: number | null;
  execution_linkage: number | null;
  evidence_quotes: string[] | null;
  evidence_notes: string[] | null;
  strengths: string[] | null;
  improvements: string[] | null;
  communication_style: string | null;
  summary: string | null;
  raw_response: string | null;
  scores?: DynamicScores | null;
  criteria_snapshot?: CriteriaSnapshot | null;
  created_at?: string;
  updated_at?: string;
}
