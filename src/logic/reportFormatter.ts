import type { TfMeetingAttendee } from "../types/meeting.js";
import type { OutMeetingEval, OutIndividualEval } from "../types/evaluation.js";
import type { MeetingReport, IndividualReport } from "../types/api.js";
import type { ScoringCriteria } from "../types/scoring-criteria.js";
import { buildMeetingChartUrl, buildIndividualChartUrl, buildDynamicChartUrl } from "../services/chartGenerator.js";

const MEETING_AXIS_LABELS: Record<string, string> = {
  goal_clarity: "目的の明確さ",
  decision_made: "意思決定",
  todo_clarity: "TODO明確化",
  role_clarity: "役割明確さ",
  time_efficiency: "時間効率",
  participation_balance: "発言バランス",
};

const INDIVIDUAL_AXIS_LABELS: Record<string, string> = {
  issue_comprehension: "課題理解度",
  value_density: "発言価値密度",
  structured_thinking: "構造的思考",
  collaborative_influence: "協調的影響力",
  decision_drive: "意思決定推進",
  execution_linkage: "実行連携度",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function listToHtml(items: string[] | null): string {
  if (!items || items.length === 0) return "<p>N/A</p>";
  return "<ul>" + items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") + "</ul>";
}

function listToText(items: string[] | null): string {
  if (!items || items.length === 0) return "  N/A";
  return items.map((item) => `  - ${item}`).join("\n");
}

function numberedListToText(items: string[] | null): string {
  if (!items || items.length === 0) return "  N/A";
  return items.map((item, i) => `  ${i + 1}. ${item}`).join("\n");
}

function getScore(ev: OutMeetingEval, axis: string): number | null {
  if (ev.scores && axis in ev.scores) return ev.scores[axis] ?? null;
  return (ev as unknown as Record<string, unknown>)[axis] as number | null ?? null;
}

function getIndividualScore(ev: OutIndividualEval, axis: string): number | null {
  if (ev.scores && axis in ev.scores) return ev.scores[axis] ?? null;
  return (ev as unknown as Record<string, unknown>)[axis] as number | null ?? null;
}

function resolveAxisLabel(key: string | null, criteria?: ScoringCriteria[]): string {
  if (!key) return "N/A";
  if (criteria) {
    const found = criteria.find((c) => c.key === key);
    if (found) return found.name_ja;
  }
  return MEETING_AXIS_LABELS[key] ?? INDIVIDUAL_AXIS_LABELS[key] ?? key;
}

export function buildMeetingReport(
  evalResult: OutMeetingEval,
  attendees: TfMeetingAttendee[],
  meetingTitle?: string,
  meetingCriteria?: ScoringCriteria[],
): MeetingReport {
  const to = attendees.map((a) => a.email);
  const titlePart = meetingTitle ?? evalResult.headline ?? "評価結果";
  const subject = `会議評価レポート: ${titlePart}`;

  // Determine which axes to use
  const useDynamic = meetingCriteria && meetingCriteria.length > 0;
  const axisEntries: { key: string; label: string; score: number | null }[] = [];

  if (useDynamic) {
    for (const c of meetingCriteria) {
      axisEntries.push({ key: c.key, label: c.name_ja, score: getScore(evalResult, c.key) });
    }
  } else {
    // Fallback to hardcoded 6 axes
    for (const [key, label] of Object.entries(MEETING_AXIS_LABELS)) {
      axisEntries.push({ key, label, score: getScore(evalResult, key) });
    }
  }

  const axisCount = axisEntries.length;
  const validScores = axisEntries.map((a) => a.score ?? 0);
  const avgScore = evalResult.evaluation_status === "success" && axisCount > 0
    ? validScores.reduce((s, v) => s + v, 0) / axisCount
    : 0;

  let chartUrl = "";
  if (evalResult.evaluation_status === "success") {
    if (useDynamic && evalResult.scores) {
      chartUrl = buildDynamicChartUrl(evalResult.scores, meetingCriteria!);
    } else {
      chartUrl = buildMeetingChartUrl({
        goal_clarity: evalResult.goal_clarity ?? 0,
        decision_made: evalResult.decision_made ?? 0,
        todo_clarity: evalResult.todo_clarity ?? 0,
        role_clarity: evalResult.role_clarity ?? 0,
        time_efficiency: evalResult.time_efficiency ?? 0,
        participation_balance: evalResult.participation_balance ?? 0,
      });
    }
  }

  // Dynamic score table rows
  const scoreRowsHtml = axisEntries
    .map((a) => `    <tr><td>${a.label}</td><td>${a.score ?? "-"}/5</td></tr>`)
    .join("\n");
  const scoreRowsText = axisEntries
    .map((a) => `  ${a.label}: ${a.score ?? "-"}/5`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }
  h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
  .score-table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .score-table td, .score-table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .score-table th { background: #f5f5f5; }
  .avg-score { font-size: 1.2em; color: #1a73e8; font-weight: bold; margin: 8px 0; }
  .axis-box { background: #f8f9fa; border-left: 4px solid #1a73e8; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .axis-box.weak { border-left-color: #ea4335; }
  .section-desc { color: #666; line-height: 1.6; }
  .topic-list { background: #f0f4ff; padding: 12px; border-radius: 4px; }
  .recommendation { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px; margin: 8px 0; line-height: 1.6; }
</style></head>
<body>
  <h1>${escapeHtml(evalResult.headline ?? "会議評価レポート")}</h1>

  <h2>AI分析ヘッドライン</h2>
  <p class="section-desc">${escapeHtml(evalResult.overall_assessment ?? "")}</p>

  <p class="avg-score">総合平均スコア: ${avgScore.toFixed(1)} / 5.0</p>

  ${chartUrl ? `<img src="${chartUrl}" alt="Radar Chart" width="400" height="400">` : ""}

  <h2>評価スコア</h2>
  <table class="score-table">
    <tr><th>項目</th><th>スコア</th></tr>
${scoreRowsHtml}
  </table>

  <h2>主な議題</h2>
  <div class="topic-list">${listToHtml(evalResult.key_topics)}</div>

  <h2>強み軸: ${escapeHtml(resolveAxisLabel(evalResult.strength_axis, meetingCriteria))}</h2>
  <div class="axis-box">${escapeHtml(evalResult.strength_reason ?? "N/A")}</div>

  <h2>弱み軸: ${escapeHtml(resolveAxisLabel(evalResult.weakness_axis, meetingCriteria))}</h2>
  <div class="axis-box weak">${escapeHtml(evalResult.weakness_reason ?? "N/A")}</div>

  <h2>特筆事項</h2>
  ${listToHtml(evalResult.special_notes)}

  <h2>決定事項</h2>
  ${listToHtml(evalResult.decisions)}

  <h2>アクションアイテム</h2>
  ${listToHtml(evalResult.action_items)}

  <h2>改善提言</h2>
  ${(evalResult.recommendations ?? []).map(r => `<div class="recommendation">${escapeHtml(r)}</div>`).join("") || "<p>N/A</p>"}

  <h2>発言バランス分析</h2>
  <p class="section-desc">${escapeHtml(evalResult.participation_note ?? "N/A")}</p>
</body>
</html>`;

  const text = `━━━━━━━━━━━━━━━━━━
■ 会議評価レポート: ${evalResult.headline ?? "評価結果"}
━━━━━━━━━━━━━━━━━━

■ AI分析ヘッドライン
${evalResult.overall_assessment ?? ""}

■ 総合平均スコア: ${avgScore.toFixed(1)} / 5.0

■ 評価スコア
${scoreRowsText}

■ 主な議題
${numberedListToText(evalResult.key_topics)}

■ 強み軸: ${resolveAxisLabel(evalResult.strength_axis, meetingCriteria)}
  ${evalResult.strength_reason ?? "N/A"}

■ 弱み軸: ${resolveAxisLabel(evalResult.weakness_axis, meetingCriteria)}
  ${evalResult.weakness_reason ?? "N/A"}

■ 特筆事項
${numberedListToText(evalResult.special_notes)}

■ 決定事項
${listToText(evalResult.decisions)}

■ アクションアイテム
${listToText(evalResult.action_items)}

■ 改善提言
${numberedListToText(evalResult.recommendations)}

■ 発言バランス分析
  ${evalResult.participation_note ?? "N/A"}`;

  return { to, subject, html, text, chartUrl };
}

export function buildIndividualReports(
  evalResults: OutIndividualEval[],
  meetingTitle?: string,
  individualCriteria?: ScoringCriteria[],
): IndividualReport[] {
  return evalResults.map((evalResult) => {
    const titlePart = meetingTitle ? `${meetingTitle} - ${evalResult.email}` : evalResult.email;
    const subject = `個人評価レポート: ${titlePart}`;

    const useDynamic = individualCriteria && individualCriteria.length > 0;
    const axisEntries: { key: string; label: string; score: number | null }[] = [];

    if (useDynamic) {
      for (const c of individualCriteria) {
        axisEntries.push({ key: c.key, label: c.name_ja, score: getIndividualScore(evalResult, c.key) });
      }
    } else {
      for (const [key, label] of Object.entries(INDIVIDUAL_AXIS_LABELS)) {
        axisEntries.push({ key, label, score: getIndividualScore(evalResult, key) });
      }
    }

    const axisCount = axisEntries.length;
    const validScores = axisEntries.map((a) => a.score ?? 0);
    const avgScore = evalResult.evaluation_status === "success" && axisCount > 0
      ? validScores.reduce((s, v) => s + v, 0) / axisCount
      : 0;

    let chartUrl = "";
    if (evalResult.evaluation_status === "success") {
      if (useDynamic && evalResult.scores) {
        chartUrl = buildDynamicChartUrl(evalResult.scores, individualCriteria!);
      } else {
        chartUrl = buildIndividualChartUrl({
          issue_comprehension: evalResult.issue_comprehension ?? 0,
          value_density: evalResult.value_density ?? 0,
          structured_thinking: evalResult.structured_thinking ?? 0,
          collaborative_influence: evalResult.collaborative_influence ?? 0,
          decision_drive: evalResult.decision_drive ?? 0,
          execution_linkage: evalResult.execution_linkage ?? 0,
        });
      }
    }

    const scoreRowsHtml = axisEntries
      .map((a) => `    <tr><td>${a.label}</td><td>${a.score ?? "-"}/5</td></tr>`)
      .join("\n");
    const scoreRowsText = axisEntries
      .map((a) => `  ${a.label}: ${a.score ?? "-"}/5`)
      .join("\n");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }
  h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
  .score-table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .score-table td, .score-table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .score-table th { background: #f5f5f5; }
  .avg-score { font-size: 1.2em; color: #1a73e8; font-weight: bold; margin: 8px 0; }
  .section-desc { color: #666; line-height: 1.6; }
  .strength-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .improve-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .comm-box { background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 12px; margin: 8px 0; line-height: 1.6; }
  blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding: 4px 12px; color: #555; font-style: italic; }
</style></head>
<body>
  <h1>個人評価レポート</h1>
  <p><strong>${escapeHtml(evalResult.email)}</strong></p>

  <p class="avg-score">総合平均スコア: ${avgScore.toFixed(1)} / 5.0</p>

  ${chartUrl ? `<img src="${chartUrl}" alt="Radar Chart" width="400" height="400">` : ""}

  <h2>評価スコア</h2>
  <table class="score-table">
    <tr><th>項目</th><th>スコア</th></tr>
${scoreRowsHtml}
  </table>

  <h2>総合サマリー</h2>
  <p class="section-desc">${escapeHtml(evalResult.summary ?? "N/A")}</p>

  <h2>コミュニケーションスタイル</h2>
  <div class="comm-box">${escapeHtml(evalResult.communication_style ?? "N/A")}</div>

  <h2>強み</h2>
  ${(evalResult.strengths ?? []).map(s => `<div class="strength-box">${escapeHtml(s)}</div>`).join("") || "<p>N/A</p>"}

  <h2>改善提案</h2>
  ${(evalResult.improvements ?? []).map(s => `<div class="improve-box">${escapeHtml(s)}</div>`).join("") || "<p>N/A</p>"}

  <h2>エビデンス - 発言引用</h2>
  ${(evalResult.evidence_quotes ?? []).map(q => `<blockquote>${escapeHtml(q)}</blockquote>`).join("") || "<p>N/A</p>"}

  <h2>エビデンス - 観察ノート</h2>
  ${listToHtml(evalResult.evidence_notes)}
</body>
</html>`;

    const text = `━━━━━━━━━━━━━━━━━━
■ 個人評価レポート: ${evalResult.email}
━━━━━━━━━━━━━━━━━━

■ 総合平均スコア: ${avgScore.toFixed(1)} / 5.0

■ 評価スコア
${scoreRowsText}

■ 総合サマリー
  ${evalResult.summary ?? "N/A"}

■ コミュニケーションスタイル
  ${evalResult.communication_style ?? "N/A"}

■ 強み
${listToText(evalResult.strengths)}

■ 改善提案
${listToText(evalResult.improvements)}

■ エビデンス - 発言引用
${listToText(evalResult.evidence_quotes)}

■ エビデンス - 観察ノート
${listToText(evalResult.evidence_notes)}`;

    return { to: evalResult.email, subject, html, text };
  });
}
