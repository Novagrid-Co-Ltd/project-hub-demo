import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import type { RowMeetingRaw, TfMeetingAttendee } from "../types/meeting.js";
import type { OutMeetingEval, OutIndividualEval } from "../types/evaluation.js";
import type { ScoringCriteria } from "../types/scoring-criteria.js";
import { logger } from "../utils/logger.js";

function getSupabase() {
  const cfg = getConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
}

// --- Score helper: JSONB first, legacy column fallback ---

function getMeetingScore(ev: OutMeetingEval, axis: string): number {
  if (ev.scores && axis in ev.scores) return ev.scores[axis] ?? 0;
  return (ev as unknown as Record<string, unknown>)[axis] as number ?? 0;
}

function getIndividualScore(ev: OutIndividualEval, axis: string): number {
  if (ev.scores && axis in ev.scores) return ev.scores[axis] ?? 0;
  return (ev as unknown as Record<string, unknown>)[axis] as number ?? 0;
}

// --- Types for aggregated data ---

export interface MeetingAxisStats {
  avg: number;
  min: number;
  max: number;
}

export interface MeetingQualitativeItem {
  meetingTitle: string;
  date: string;
  text: string;
}

export interface AggregatedMeetingScores {
  axisStats: Record<string, MeetingAxisStats>;
  overallAvg: number;
  bestMeeting: { meetInstanceKey: string; title: string; date: string; avgScore: number } | null;
  worstMeeting: { meetInstanceKey: string; title: string; date: string; avgScore: number } | null;
  strengthAxisCounts: Record<string, number>;
  weaknessAxisCounts: Record<string, number>;
  allRecommendations: MeetingQualitativeItem[];
  allDecisions: MeetingQualitativeItem[];
  allActionItems: MeetingQualitativeItem[];
  // Legacy accessors for backward compatibility
  goal_clarity: MeetingAxisStats;
  decision_made: MeetingAxisStats;
  todo_clarity: MeetingAxisStats;
  role_clarity: MeetingAxisStats;
  time_efficiency: MeetingAxisStats;
  participation_balance: MeetingAxisStats;
}

export interface MeetingScoreRow {
  meetInstanceKey: string;
  title: string;
  date: string;
  avgScore: number;
  axisScores: Record<string, number>;
  // Legacy direct accessors
  goal_clarity: number;
  decision_made: number;
  todo_clarity: number;
  role_clarity: number;
  time_efficiency: number;
  participation_balance: number;
  // Qualitative data
  headline: string | null;
  overall_assessment: string | null;
  strength_axis: string | null;
  strength_reason: string | null;
  weakness_axis: string | null;
  weakness_reason: string | null;
  recommendations: string[];
  decisions: string[];
  action_items: string[];
  key_topics: string[];
  participation_note: string | null;
}

export interface IndividualAxisScore {
  key: string;
  label: string;
  avg: number;
}

export interface IndividualMonthlyScore {
  email: string;
  displayName: string;
  meetingCount: number;
  axisScores: Record<string, number>;
  // Legacy direct accessors
  issue_comprehension: number;
  value_density: number;
  structured_thinking: number;
  collaborative_influence: number;
  decision_drive: number;
  execution_linkage: number;
  overallAvg: number;
  highestAxis: { name: string; score: number };
  lowestAxis: { name: string; score: number };
  meetings: { meetInstanceKey: string; title: string; date: string; avgScore: number }[];
  allStrengths: string[];
  allImprovements: string[];
  communicationStyles: string[];
  summaries: string[];
  representativeQuotes: string[];
}

export interface MonthlyData {
  year: number;
  month: number;
  meetings: RowMeetingRaw[];
  meetingEvals: OutMeetingEval[];
  individualEvals: OutIndividualEval[];
  attendees: TfMeetingAttendee[];
}

export interface AggregatedMonthlyData {
  year: number;
  month: number;
  meetingCount: number;
  participantEmails: string[];
  meetingScores: AggregatedMeetingScores;
  meetingScoreRows: MeetingScoreRow[];
  individualScores: IndividualMonthlyScore[];
  meetingCriteria: ScoringCriteria[];
  individualCriteria: ScoringCriteria[];
}

// --- Default axes (used when no criteria provided) ---

const DEFAULT_MEETING_AXES = [
  "goal_clarity", "decision_made", "todo_clarity",
  "role_clarity", "time_efficiency", "participation_balance",
];

const DEFAULT_INDIVIDUAL_AXES = [
  "issue_comprehension", "value_density", "structured_thinking",
  "collaborative_influence", "decision_drive", "execution_linkage",
];

const DEFAULT_INDIVIDUAL_AXIS_LABELS: Record<string, string> = {
  issue_comprehension: "課題理解度",
  value_density: "発言価値密度",
  structured_thinking: "構造的思考",
  collaborative_influence: "協調的影響力",
  decision_drive: "意思決定推進",
  execution_linkage: "実行連携度",
};

// --- Data fetching ---

export async function fetchMonthlyData(year: number, month: number): Promise<MonthlyData> {
  const sb = getSupabase();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00`;

  logger.info("Fetching monthly data", { year, month, startDate, endDate });

  const { data: meetings, error: meetingsErr } = await sb
    .from("eval_meeting_raw")
    .select("*")
    .gte("event_start", startDate)
    .lt("event_start", endDate)
    .order("event_start", { ascending: true });

  if (meetingsErr) throw meetingsErr;
  const meetingRows = (meetings ?? []) as RowMeetingRaw[];
  const meetKeys = meetingRows.map((m) => m.meet_instance_key);

  if (meetKeys.length === 0) {
    return { year, month, meetings: [], meetingEvals: [], individualEvals: [], attendees: [] };
  }

  const { data: meetingEvals, error: meErr } = await sb
    .from("eval_meeting_score")
    .select("*")
    .in("meet_instance_key", meetKeys)
    .eq("evaluation_status", "success");

  if (meErr) throw meErr;

  const { data: individualEvals, error: ieErr } = await sb
    .from("eval_individual_score")
    .select("*")
    .in("meet_instance_key", meetKeys)
    .eq("evaluation_status", "success");

  if (ieErr) throw ieErr;

  const { data: attendees, error: atErr } = await sb
    .from("eval_meeting_attendee")
    .select("*")
    .in("meet_instance_key", meetKeys);

  if (atErr) throw atErr;

  logger.info("Monthly data fetched", {
    meetings: meetingRows.length,
    meetingEvals: (meetingEvals ?? []).length,
    individualEvals: (individualEvals ?? []).length,
    attendees: (attendees ?? []).length,
  });

  return {
    year,
    month,
    meetings: meetingRows,
    meetingEvals: (meetingEvals ?? []) as OutMeetingEval[],
    individualEvals: (individualEvals ?? []) as OutIndividualEval[],
    attendees: (attendees ?? []) as TfMeetingAttendee[],
  };
}

// --- Aggregation ---

function meetingAvgScore(ev: OutMeetingEval, axes: string[]): number {
  if (axes.length === 0) return 0;
  let sum = 0;
  for (const axis of axes) {
    sum += getMeetingScore(ev, axis);
  }
  return sum / axes.length;
}

export function aggregateMeetingScores(
  meetingEvals: OutMeetingEval[],
  meetings: RowMeetingRaw[],
  meetingCriteria?: ScoringCriteria[],
): { scores: AggregatedMeetingScores; rows: MeetingScoreRow[] } {
  const meetingMap = new Map(meetings.map((m) => [m.meet_instance_key, m]));
  const axes = meetingCriteria && meetingCriteria.length > 0
    ? meetingCriteria.map((c) => c.key)
    : DEFAULT_MEETING_AXES;

  const rows: MeetingScoreRow[] = meetingEvals.map((ev) => {
    const meeting = meetingMap.get(ev.meet_instance_key);
    const axisScores: Record<string, number> = {};
    for (const axis of axes) {
      axisScores[axis] = getMeetingScore(ev, axis);
    }
    return {
      meetInstanceKey: ev.meet_instance_key,
      title: meeting?.event_summary ?? ev.meet_instance_key,
      date: meeting?.event_start ?? "",
      avgScore: meetingAvgScore(ev, axes),
      axisScores,
      goal_clarity: getMeetingScore(ev, "goal_clarity"),
      decision_made: getMeetingScore(ev, "decision_made"),
      todo_clarity: getMeetingScore(ev, "todo_clarity"),
      role_clarity: getMeetingScore(ev, "role_clarity"),
      time_efficiency: getMeetingScore(ev, "time_efficiency"),
      participation_balance: getMeetingScore(ev, "participation_balance"),
      headline: ev.headline,
      overall_assessment: ev.overall_assessment,
      strength_axis: ev.strength_axis,
      strength_reason: ev.strength_reason,
      weakness_axis: ev.weakness_axis,
      weakness_reason: ev.weakness_reason,
      recommendations: ev.recommendations ?? [],
      decisions: ev.decisions ?? [],
      action_items: ev.action_items ?? [],
      key_topics: ev.key_topics ?? [],
      participation_note: ev.participation_note,
    };
  });

  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Axis stats (dynamic)
  const axisStats: Record<string, MeetingAxisStats> = {};
  for (const axis of axes) {
    const values = meetingEvals.map((ev) => getMeetingScore(ev, axis));
    axisStats[axis] = {
      avg: values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
    };
  }

  const overallAvg =
    meetingEvals.length > 0
      ? meetingEvals.reduce((s, ev) => s + meetingAvgScore(ev, axes), 0) / meetingEvals.length
      : 0;

  const best = rows.length > 0 ? rows.reduce((a, b) => (a.avgScore >= b.avgScore ? a : b)) : null;
  const worst = rows.length > 0 ? rows.reduce((a, b) => (a.avgScore <= b.avgScore ? a : b)) : null;

  const strengthAxisCounts: Record<string, number> = {};
  const weaknessAxisCounts: Record<string, number> = {};
  const allRecommendations: MeetingQualitativeItem[] = [];
  const allDecisions: MeetingQualitativeItem[] = [];
  const allActionItems: MeetingQualitativeItem[] = [];

  for (const row of rows) {
    if (row.strength_axis) {
      strengthAxisCounts[row.strength_axis] = (strengthAxisCounts[row.strength_axis] ?? 0) + 1;
    }
    if (row.weakness_axis) {
      weaknessAxisCounts[row.weakness_axis] = (weaknessAxisCounts[row.weakness_axis] ?? 0) + 1;
    }
    for (const r of row.recommendations) {
      allRecommendations.push({ meetingTitle: row.title, date: row.date, text: r });
    }
    for (const d of row.decisions) {
      allDecisions.push({ meetingTitle: row.title, date: row.date, text: d });
    }
    for (const a of row.action_items) {
      allActionItems.push({ meetingTitle: row.title, date: row.date, text: a });
    }
  }

  const defaultStats: MeetingAxisStats = { avg: 0, min: 0, max: 0 };

  return {
    scores: {
      axisStats,
      overallAvg,
      bestMeeting: best
        ? { meetInstanceKey: best.meetInstanceKey, title: best.title, date: best.date, avgScore: best.avgScore }
        : null,
      worstMeeting: worst
        ? { meetInstanceKey: worst.meetInstanceKey, title: worst.title, date: worst.date, avgScore: worst.avgScore }
        : null,
      strengthAxisCounts,
      weaknessAxisCounts,
      allRecommendations,
      allDecisions,
      allActionItems,
      // Legacy accessors
      goal_clarity: axisStats["goal_clarity"] ?? defaultStats,
      decision_made: axisStats["decision_made"] ?? defaultStats,
      todo_clarity: axisStats["todo_clarity"] ?? defaultStats,
      role_clarity: axisStats["role_clarity"] ?? defaultStats,
      time_efficiency: axisStats["time_efficiency"] ?? defaultStats,
      participation_balance: axisStats["participation_balance"] ?? defaultStats,
    },
    rows,
  };
}

export function aggregateIndividualScores(
  individualEvals: OutIndividualEval[],
  meetings: RowMeetingRaw[],
  attendees: TfMeetingAttendee[],
  individualCriteria?: ScoringCriteria[],
): IndividualMonthlyScore[] {
  const meetingMap = new Map(meetings.map((m) => [m.meet_instance_key, m]));
  const axes = individualCriteria && individualCriteria.length > 0
    ? individualCriteria.map((c) => c.key)
    : DEFAULT_INDIVIDUAL_AXES;
  const axisLabels: Record<string, string> = {};
  if (individualCriteria && individualCriteria.length > 0) {
    for (const c of individualCriteria) {
      axisLabels[c.key] = c.name_ja;
    }
  } else {
    Object.assign(axisLabels, DEFAULT_INDIVIDUAL_AXIS_LABELS);
  }

  const nameMap = new Map<string, string>();
  for (const a of attendees) {
    if (!nameMap.has(a.email)) {
      nameMap.set(a.email, a.display_name);
    }
  }

  const grouped = new Map<string, OutIndividualEval[]>();
  for (const ev of individualEvals) {
    const list = grouped.get(ev.email) ?? [];
    list.push(ev);
    grouped.set(ev.email, list);
  }

  const results: IndividualMonthlyScore[] = [];

  for (const [email, evals] of grouped) {
    const axisAvgs: Record<string, number> = {};
    for (const axis of axes) {
      const values = evals.map((ev) => getIndividualScore(ev, axis));
      axisAvgs[axis] = values.reduce((s, v) => s + v, 0) / values.length;
    }

    const overallAvg = axes.length > 0
      ? axes.reduce((s, a) => s + (axisAvgs[a] ?? 0), 0) / axes.length
      : 0;

    // Highest / lowest axis
    let highest = { name: axisLabels[axes[0]] ?? axes[0], score: axisAvgs[axes[0]] ?? 0 };
    let lowest = { name: axisLabels[axes[0]] ?? axes[0], score: axisAvgs[axes[0]] ?? 0 };
    for (const axis of axes) {
      const score = axisAvgs[axis] ?? 0;
      const label = axisLabels[axis] ?? axis;
      if (score > highest.score) highest = { name: label, score };
      if (score < lowest.score) lowest = { name: label, score };
    }

    const meetingScores = evals.map((ev) => {
      const meeting = meetingMap.get(ev.meet_instance_key);
      const avg = axes.length > 0
        ? axes.reduce((s, a) => s + getIndividualScore(ev, a), 0) / axes.length
        : 0;
      return {
        meetInstanceKey: ev.meet_instance_key,
        title: meeting?.event_summary ?? ev.meet_instance_key,
        date: meeting?.event_start ?? "",
        avgScore: avg,
      };
    });
    meetingScores.sort((a, b) => a.date.localeCompare(b.date));

    const allStrengths: string[] = [];
    const allImprovements: string[] = [];
    const communicationStyles: string[] = [];
    const summaries: string[] = [];
    const representativeQuotes: string[] = [];

    for (const ev of evals) {
      if (ev.strengths) allStrengths.push(...ev.strengths);
      if (ev.improvements) allImprovements.push(...ev.improvements);
      if (ev.communication_style) communicationStyles.push(ev.communication_style);
      if (ev.summary) summaries.push(ev.summary);
      if (ev.evidence_quotes) representativeQuotes.push(...ev.evidence_quotes);
    }

    results.push({
      email,
      displayName: nameMap.get(email) ?? email,
      meetingCount: evals.length,
      axisScores: axisAvgs,
      // Legacy direct accessors
      issue_comprehension: axisAvgs["issue_comprehension"] ?? 0,
      value_density: axisAvgs["value_density"] ?? 0,
      structured_thinking: axisAvgs["structured_thinking"] ?? 0,
      collaborative_influence: axisAvgs["collaborative_influence"] ?? 0,
      decision_drive: axisAvgs["decision_drive"] ?? 0,
      execution_linkage: axisAvgs["execution_linkage"] ?? 0,
      overallAvg,
      highestAxis: highest,
      lowestAxis: lowest,
      meetings: meetingScores,
      allStrengths,
      allImprovements,
      communicationStyles,
      summaries,
      representativeQuotes: representativeQuotes.slice(0, 5),
    });
  }

  results.sort((a, b) => a.email.localeCompare(b.email));
  return results;
}

export function aggregateMonthlyData(
  data: MonthlyData,
  meetingCriteria?: ScoringCriteria[],
  individualCriteria?: ScoringCriteria[],
): AggregatedMonthlyData {
  const { scores, rows } = aggregateMeetingScores(data.meetingEvals, data.meetings, meetingCriteria);
  const individualScores = aggregateIndividualScores(data.individualEvals, data.meetings, data.attendees, individualCriteria);

  const emailSet = new Set<string>();
  for (const a of data.attendees) {
    emailSet.add(a.email);
  }

  return {
    year: data.year,
    month: data.month,
    meetingCount: data.meetings.length,
    participantEmails: Array.from(emailSet).sort(),
    meetingScores: scores,
    meetingScoreRows: rows,
    individualScores,
    meetingCriteria: meetingCriteria ?? [],
    individualCriteria: individualCriteria ?? [],
  };
}
