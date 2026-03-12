import type { MeetingReport, IndividualReport } from "../types/api.js";
import type { ScoringCriteria } from "../types/scoring-criteria.js";
import { buildMeetingChartUrl, buildIndividualChartUrl, buildDynamicChartUrl } from "../services/chartGenerator.js";
import type { AggregatedMonthlyData, MeetingScoreRow, IndividualMonthlyScore, MeetingQualitativeItem } from "./monthlyAggregation.js";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "-";
  return isoDate.slice(0, 10);
}

function formatScore(score: number): string {
  return score.toFixed(1);
}

const DEFAULT_MEETING_AXIS_LABELS: Record<string, string> = {
  goal_clarity: "目的の明確さ",
  decision_made: "意思決定",
  todo_clarity: "TODO明確化",
  role_clarity: "役割明確さ",
  time_efficiency: "時間効率",
  participation_balance: "発言バランス",
};

const DEFAULT_INDIVIDUAL_AXIS_LABELS: Record<string, string> = {
  issue_comprehension: "課題理解度",
  value_density: "発言価値密度",
  structured_thinking: "構造的思考",
  collaborative_influence: "協調的影響力",
  decision_drive: "意思決定推進",
  execution_linkage: "実行連携度",
};

function resolveAxisLabel(key: string, criteria?: ScoringCriteria[]): string {
  if (criteria && criteria.length > 0) {
    const found = criteria.find((c) => c.key === key);
    if (found) return found.name_ja;
  }
  return DEFAULT_MEETING_AXIS_LABELS[key] ?? DEFAULT_INDIVIDUAL_AXIS_LABELS[key] ?? key;
}

function listToHtml(items: string[]): string {
  if (items.length === 0) return "<p>N/A</p>";
  return "<ul>" + items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") + "</ul>";
}

function listToText(items: string[]): string {
  if (items.length === 0) return "  N/A";
  return items.map((item) => `  - ${item}`).join("\n");
}

function qualitativeItemsToHtml(items: MeetingQualitativeItem[]): string {
  if (items.length === 0) return "<p>N/A</p>";
  return items
    .map((item) => `<li><strong>${escapeHtml(formatDate(item.date))} ${escapeHtml(item.meetingTitle)}</strong>: ${escapeHtml(item.text)}</li>`)
    .join("");
}

function qualitativeItemsToText(items: MeetingQualitativeItem[]): string {
  if (items.length === 0) return "  N/A";
  return items
    .map((item) => `  - [${formatDate(item.date)} ${item.meetingTitle}] ${item.text}`)
    .join("\n");
}

function sortedAxisCounts(counts: Record<string, number>): { axis: string; count: number }[] {
  return Object.entries(counts)
    .map(([axis, count]) => ({ axis, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Monthly Summary Report ---

export function buildMonthlySummaryReport(data: AggregatedMonthlyData): MeetingReport {
  const period = `${data.year}年${data.month}月`;
  const to = data.participantEmails;
  const subject = `月次会議評価サマリー: ${period}`;

  const scores = data.meetingScores;
  const meetingCriteria = data.meetingCriteria;
  const useDynamic = meetingCriteria && meetingCriteria.length > 0;

  // Build chart
  let chartUrl = "";
  if (useDynamic) {
    const avgScores: Record<string, number> = {};
    for (const c of meetingCriteria) {
      avgScores[c.key] = scores.axisStats[c.key]?.avg ?? 0;
    }
    chartUrl = buildDynamicChartUrl(avgScores, meetingCriteria);
  } else {
    chartUrl = buildMeetingChartUrl({
      goal_clarity: scores.goal_clarity.avg,
      decision_made: scores.decision_made.avg,
      todo_clarity: scores.todo_clarity.avg,
      role_clarity: scores.role_clarity.avg,
      time_efficiency: scores.time_efficiency.avg,
      participation_balance: scores.participation_balance.avg,
    });
  }

  const html = buildMonthlySummaryHtml(data, period, chartUrl);
  const text = buildMonthlySummaryText(data, period);

  return { to, subject, html, text, chartUrl };
}

function getAxisEntries(data: AggregatedMonthlyData): { key: string; label: string; stats: { avg: number; min: number; max: number } }[] {
  const meetingCriteria = data.meetingCriteria;
  const s = data.meetingScores;

  if (meetingCriteria && meetingCriteria.length > 0) {
    return meetingCriteria.map((c) => ({
      key: c.key,
      label: c.name_ja,
      stats: s.axisStats[c.key] ?? { avg: 0, min: 0, max: 0 },
    }));
  }

  // Legacy fallback
  return [
    { key: "goal_clarity", label: "目的の明確さ", stats: s.goal_clarity },
    { key: "decision_made", label: "意思決定", stats: s.decision_made },
    { key: "todo_clarity", label: "TODO明確化", stats: s.todo_clarity },
    { key: "role_clarity", label: "役割明確さ", stats: s.role_clarity },
    { key: "time_efficiency", label: "時間効率", stats: s.time_efficiency },
    { key: "participation_balance", label: "発言バランス", stats: s.participation_balance },
  ];
}

function buildMonthlySummaryHtml(data: AggregatedMonthlyData, period: string, chartUrl: string): string {
  const s = data.meetingScores;
  const axes = getAxisEntries(data);
  const meetingCriteria = data.meetingCriteria;

  const axisRowsHtml = axes
    .map(
      (a) =>
        `<tr><td>${a.label}</td><td>${formatScore(a.stats.avg)}</td><td>${formatScore(a.stats.max)}</td><td>${formatScore(a.stats.min)}</td></tr>`,
    )
    .join("");

  const meetingRowsHtml = data.meetingScoreRows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(formatDate(r.date))}</td><td>${escapeHtml(r.title)}</td><td>${formatScore(r.avgScore)}</td><td>${escapeHtml(r.headline ?? "-")}</td></tr>`,
    )
    .join("");

  const best = s.bestMeeting;
  const worst = s.worstMeeting;

  const strengthTrend = sortedAxisCounts(s.strengthAxisCounts);
  const weaknessTrend = sortedAxisCounts(s.weaknessAxisCounts);

  const strengthTrendHtml = strengthTrend.length > 0
    ? strengthTrend.map((t) => `<li>${escapeHtml(resolveAxisLabel(t.axis, meetingCriteria))}: ${t.count}回</li>`).join("")
    : "<li>N/A</li>";
  const weaknessTrendHtml = weaknessTrend.length > 0
    ? weaknessTrend.map((t) => `<li>${escapeHtml(resolveAxisLabel(t.axis, meetingCriteria))}: ${t.count}回</li>`).join("")
    : "<li>N/A</li>";

  const bestRow = best ? data.meetingScoreRows.find((r) => r.meetInstanceKey === best.meetInstanceKey) : null;
  const worstRow = worst ? data.meetingScoreRows.find((r) => r.meetInstanceKey === worst.meetInstanceKey) : null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }
  h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
  h3 { color: #555; margin-top: 16px; }
  .score-table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .score-table td, .score-table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .score-table th { background: #f5f5f5; }
  .avg-score { font-size: 1.2em; color: #1a73e8; font-weight: bold; margin: 8px 0; }
  .highlight-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .warning-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .overview { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .trend-box { background: #f0f4ff; border-left: 4px solid #1a73e8; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .trend-box.weak { border-left-color: #ea4335; }
  .decision-item { background: #e3f2fd; padding: 10px; margin: 6px 0; border-radius: 4px; line-height: 1.5; }
  .action-item { background: #fff8e1; padding: 10px; margin: 6px 0; border-radius: 4px; line-height: 1.5; }
  .recommendation { background: #fce4ec; border-left: 4px solid #e91e63; padding: 12px; margin: 8px 0; line-height: 1.6; }
</style></head>
<body>
  <h1>${escapeHtml(period)} 会議評価 月次サマリー</h1>

  <div class="overview">
    <p><strong>対象期間:</strong> ${escapeHtml(period)}</p>
    <p><strong>会議件数:</strong> ${data.meetingCount}件</p>
    <p><strong>参加者数:</strong> ${data.participantEmails.length}名</p>
    <p class="avg-score">全体平均スコア: ${formatScore(s.overallAvg)} / 5.0</p>
  </div>

  ${chartUrl ? `<img src="${chartUrl}" alt="Radar Chart" width="400" height="400">` : ""}

  <h2>評価スコア</h2>
  <table class="score-table">
    <tr><th>項目</th><th>平均</th><th>最高</th><th>最低</th></tr>
    ${axisRowsHtml}
  </table>

  <h2>強み・弱みの傾向</h2>
  <h3>強みとして多く評価された軸</h3>
  <div class="trend-box"><ul>${strengthTrendHtml}</ul></div>
  <h3>弱みとして多く評価された軸</h3>
  <div class="trend-box weak"><ul>${weaknessTrendHtml}</ul></div>

  <h2>会議別一覧</h2>
  <table class="score-table">
    <tr><th>日付</th><th>会議名</th><th>平均スコア</th><th>AIヘッドライン</th></tr>
    ${meetingRowsHtml}
  </table>

  ${best ? `<h2>ベスト会議</h2>
  <div class="highlight-box">
    <strong>${escapeHtml(best.title)}</strong> (${escapeHtml(formatDate(best.date))})<br>
    平均スコア: ${formatScore(best.avgScore)}
    ${bestRow?.headline ? `<br><em>${escapeHtml(bestRow.headline)}</em>` : ""}
    ${bestRow?.overall_assessment ? `<br>${escapeHtml(bestRow.overall_assessment)}` : ""}
    ${bestRow?.strength_axis ? `<br><strong>強み:</strong> ${escapeHtml(resolveAxisLabel(bestRow.strength_axis, meetingCriteria))} - ${escapeHtml(bestRow.strength_reason ?? "")}` : ""}
  </div>` : ""}

  ${worst ? `<h2>改善が必要な会議</h2>
  <div class="warning-box">
    <strong>${escapeHtml(worst.title)}</strong> (${escapeHtml(formatDate(worst.date))})<br>
    平均スコア: ${formatScore(worst.avgScore)}
    ${worstRow?.headline ? `<br><em>${escapeHtml(worstRow.headline)}</em>` : ""}
    ${worstRow?.overall_assessment ? `<br>${escapeHtml(worstRow.overall_assessment)}` : ""}
    ${worstRow?.weakness_axis ? `<br><strong>課題:</strong> ${escapeHtml(resolveAxisLabel(worstRow.weakness_axis, meetingCriteria))} - ${escapeHtml(worstRow.weakness_reason ?? "")}` : ""}
  </div>` : ""}

  ${s.allDecisions.length > 0 ? `<h2>月間の決定事項</h2>
  <ul>${qualitativeItemsToHtml(s.allDecisions)}</ul>` : ""}

  ${s.allActionItems.length > 0 ? `<h2>月間のアクションアイテム</h2>
  <ul>${qualitativeItemsToHtml(s.allActionItems)}</ul>` : ""}

  ${s.allRecommendations.length > 0 ? `<h2>AI改善提言まとめ</h2>
  ${s.allRecommendations.map((r) => `<div class="recommendation"><strong>${escapeHtml(formatDate(r.date))} ${escapeHtml(r.meetingTitle)}</strong><br>${escapeHtml(r.text)}</div>`).join("")}` : ""}

</body>
</html>`;
}

function buildMonthlySummaryText(data: AggregatedMonthlyData, period: string): string {
  const s = data.meetingScores;
  const axes = getAxisEntries(data);
  const meetingCriteria = data.meetingCriteria;

  const axisLines = axes
    .map((a) => `  ${a.label}: 平均${formatScore(a.stats.avg)} / 最高${formatScore(a.stats.max)} / 最低${formatScore(a.stats.min)}`)
    .join("\n");

  const meetingLines = data.meetingScoreRows
    .map((r) => `  ${formatDate(r.date)} | ${r.title} | ${formatScore(r.avgScore)} | ${r.headline ?? "-"}`)
    .join("\n");

  const best = s.bestMeeting;
  const worst = s.worstMeeting;
  const bestRow = best ? data.meetingScoreRows.find((r) => r.meetInstanceKey === best.meetInstanceKey) : null;
  const worstRow = worst ? data.meetingScoreRows.find((r) => r.meetInstanceKey === worst.meetInstanceKey) : null;

  const strengthTrend = sortedAxisCounts(s.strengthAxisCounts);
  const weaknessTrend = sortedAxisCounts(s.weaknessAxisCounts);

  return `━━━━━━━━━━━━━━━━━━
■ ${period} 会議評価 月次サマリー
━━━━━━━━━━━━━━━━━━

■ 概要
  対象期間: ${period}
  会議件数: ${data.meetingCount}件
  参加者数: ${data.participantEmails.length}名
  全体平均スコア: ${formatScore(s.overallAvg)} / 5.0

■ 評価スコア
${axisLines}

■ 強み・弱みの傾向
  強みとして多く評価された軸:
${strengthTrend.length > 0 ? strengthTrend.map((t) => `    ${resolveAxisLabel(t.axis, meetingCriteria)}: ${t.count}回`).join("\n") : "    N/A"}
  弱みとして多く評価された軸:
${weaknessTrend.length > 0 ? weaknessTrend.map((t) => `    ${resolveAxisLabel(t.axis, meetingCriteria)}: ${t.count}回`).join("\n") : "    N/A"}

■ 会議別一覧
${meetingLines || "  データなし"}
${best ? `\n■ ベスト会議\n  ${best.title} (${formatDate(best.date)})\n  平均スコア: ${formatScore(best.avgScore)}${bestRow?.headline ? `\n  ヘッドライン: ${bestRow.headline}` : ""}${bestRow?.overall_assessment ? `\n  AI分析: ${bestRow.overall_assessment}` : ""}` : ""}
${worst ? `\n■ 改善が必要な会議\n  ${worst.title} (${formatDate(worst.date)})\n  平均スコア: ${formatScore(worst.avgScore)}${worstRow?.headline ? `\n  ヘッドライン: ${worstRow.headline}` : ""}${worstRow?.overall_assessment ? `\n  AI分析: ${worstRow.overall_assessment}` : ""}` : ""}
${s.allDecisions.length > 0 ? `\n■ 月間の決定事項\n${qualitativeItemsToText(s.allDecisions)}` : ""}
${s.allActionItems.length > 0 ? `\n■ 月間のアクションアイテム\n${qualitativeItemsToText(s.allActionItems)}` : ""}
${s.allRecommendations.length > 0 ? `\n■ AI改善提言まとめ\n${qualitativeItemsToText(s.allRecommendations)}` : ""}`;
}

// --- Monthly Individual Reports ---

export function buildMonthlyIndividualReports(data: AggregatedMonthlyData): IndividualReport[] {
  const period = `${data.year}年${data.month}月`;
  return data.individualScores.map((ind) => buildOneIndividualReport(ind, period, data.individualCriteria));
}

function getIndividualAxisEntries(ind: IndividualMonthlyScore, criteria?: ScoringCriteria[]): { label: string; score: number }[] {
  if (criteria && criteria.length > 0) {
    return criteria.map((c) => ({
      label: c.name_ja,
      score: ind.axisScores[c.key] ?? 0,
    }));
  }
  return [
    { label: "課題理解度", score: ind.issue_comprehension },
    { label: "発言価値密度", score: ind.value_density },
    { label: "構造的思考", score: ind.structured_thinking },
    { label: "協調的影響力", score: ind.collaborative_influence },
    { label: "意思決定推進", score: ind.decision_drive },
    { label: "実行連携度", score: ind.execution_linkage },
  ];
}

function buildOneIndividualReport(ind: IndividualMonthlyScore, period: string, individualCriteria?: ScoringCriteria[]): IndividualReport {
  const subject = `月次個人評価レポート: ${period}`;
  const useDynamic = individualCriteria && individualCriteria.length > 0;

  let chartUrl = "";
  if (useDynamic) {
    chartUrl = buildDynamicChartUrl(ind.axisScores, individualCriteria!);
  } else {
    chartUrl = buildIndividualChartUrl({
      issue_comprehension: ind.issue_comprehension,
      value_density: ind.value_density,
      structured_thinking: ind.structured_thinking,
      collaborative_influence: ind.collaborative_influence,
      decision_drive: ind.decision_drive,
      execution_linkage: ind.execution_linkage,
    });
  }

  const html = buildIndividualHtml(ind, period, chartUrl, individualCriteria);
  const text = buildIndividualText(ind, period, individualCriteria);

  return { to: ind.email, subject, html, text };
}

function buildIndividualHtml(ind: IndividualMonthlyScore, period: string, chartUrl: string, criteria?: ScoringCriteria[]): string {
  const axisRows = getIndividualAxisEntries(ind, criteria);

  const axisRowsHtml = axisRows
    .map((a) => `<tr><td>${a.label}</td><td>${formatScore(a.score)}</td></tr>`)
    .join("");

  const meetingRowsHtml = ind.meetings
    .map(
      (m) =>
        `<tr><td>${escapeHtml(formatDate(m.date))}</td><td>${escapeHtml(m.title)}</td><td>${formatScore(m.avgScore)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }
  h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
  .score-table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .score-table td, .score-table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .score-table th { background: #f5f5f5; }
  .avg-score { font-size: 1.2em; color: #1a73e8; font-weight: bold; margin: 8px 0; }
  .highlight-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .warning-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .overview { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .strength-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 10px; margin: 6px 0; line-height: 1.5; }
  .improve-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; margin: 6px 0; line-height: 1.5; }
  .comm-box { background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 12px; margin: 8px 0; line-height: 1.6; }
  .summary-box { background: #e3f2fd; border-left: 4px solid #1a73e8; padding: 12px; margin: 8px 0; line-height: 1.6; }
  blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding: 4px 12px; color: #555; font-style: italic; }
</style></head>
<body>
  <h1>${escapeHtml(period)} 個人月次評価レポート: ${escapeHtml(ind.displayName)}</h1>

  <div class="overview">
    <p><strong>対象者:</strong> ${escapeHtml(ind.displayName)} (${escapeHtml(ind.email)})</p>
    <p><strong>参加会議数:</strong> ${ind.meetingCount}件</p>
    <p class="avg-score">全体平均スコア: ${formatScore(ind.overallAvg)} / 5.0</p>
  </div>

  ${chartUrl ? `<img src="${chartUrl}" alt="Radar Chart" width="400" height="400">` : ""}

  <h2>評価スコア</h2>
  <table class="score-table">
    <tr><th>項目</th><th>月間平均</th></tr>
    ${axisRowsHtml}
  </table>

  <h2>最も高い軸</h2>
  <div class="highlight-box"><strong>${escapeHtml(ind.highestAxis.name)}</strong>: ${formatScore(ind.highestAxis.score)}</div>

  <h2>最も低い軸</h2>
  <div class="warning-box"><strong>${escapeHtml(ind.lowestAxis.name)}</strong>: ${formatScore(ind.lowestAxis.score)}</div>

  ${ind.summaries.length > 0 ? `<h2>AI総合サマリー</h2>
  ${ind.summaries.map((s) => `<div class="summary-box">${escapeHtml(s)}</div>`).join("")}` : ""}

  ${ind.communicationStyles.length > 0 ? `<h2>コミュニケーションスタイル</h2>
  ${ind.communicationStyles.map((cs) => `<div class="comm-box">${escapeHtml(cs)}</div>`).join("")}` : ""}

  ${ind.allStrengths.length > 0 ? `<h2>強み（月間）</h2>
  ${ind.allStrengths.map((s) => `<div class="strength-box">${escapeHtml(s)}</div>`).join("")}` : ""}

  ${ind.allImprovements.length > 0 ? `<h2>改善提案（月間）</h2>
  ${ind.allImprovements.map((s) => `<div class="improve-box">${escapeHtml(s)}</div>`).join("")}` : ""}

  ${ind.representativeQuotes.length > 0 ? `<h2>代表的な発言引用</h2>
  ${ind.representativeQuotes.map((q) => `<blockquote>${escapeHtml(q)}</blockquote>`).join("")}` : ""}

  <h2>会議別スコア推移</h2>
  <table class="score-table">
    <tr><th>日付</th><th>会議名</th><th>平均スコア</th></tr>
    ${meetingRowsHtml}
  </table>

</body>
</html>`;
}

function buildIndividualText(ind: IndividualMonthlyScore, period: string, criteria?: ScoringCriteria[]): string {
  const axisRows = getIndividualAxisEntries(ind, criteria);
  const axisLines = axisRows.map((a) => `  ${a.label}: ${formatScore(a.score)}`).join("\n");

  const meetingLines = ind.meetings
    .map((m) => `  ${formatDate(m.date)} | ${m.title} | ${formatScore(m.avgScore)}`)
    .join("\n");

  return `━━━━━━━━━━━━━━━━━━
■ ${period} 個人月次評価レポート: ${ind.displayName}
━━━━━━━━━━━━━━━━━━

■ 概要
  対象者: ${ind.displayName} (${ind.email})
  参加会議数: ${ind.meetingCount}件
  全体平均スコア: ${formatScore(ind.overallAvg)} / 5.0

■ 評価スコア
${axisLines}

■ 最も高い軸: ${ind.highestAxis.name} (${formatScore(ind.highestAxis.score)})
■ 最も低い軸: ${ind.lowestAxis.name} (${formatScore(ind.lowestAxis.score)})
${ind.summaries.length > 0 ? `\n■ AI総合サマリー\n${ind.summaries.map((s) => `  ${s}`).join("\n\n")}` : ""}
${ind.communicationStyles.length > 0 ? `\n■ コミュニケーションスタイル\n${ind.communicationStyles.map((cs) => `  ${cs}`).join("\n\n")}` : ""}
${ind.allStrengths.length > 0 ? `\n■ 強み（月間）\n${listToText(ind.allStrengths)}` : ""}
${ind.allImprovements.length > 0 ? `\n■ 改善提案（月間）\n${listToText(ind.allImprovements)}` : ""}
${ind.representativeQuotes.length > 0 ? `\n■ 代表的な発言引用\n${ind.representativeQuotes.map((q) => `  「${q}」`).join("\n")}` : ""}

■ 会議別スコア推移
${meetingLines || "  データなし"}`;
}
