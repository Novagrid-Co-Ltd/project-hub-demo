import { getConfig } from "../config.js";

interface RadarChartData {
  labels: string[];
  values: number[];
}

export function generateRadarChartUrl(data: RadarChartData): string {
  const chartConfig = {
    type: "radar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Score",
          data: data.values,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgb(54, 162, 235)",
          pointBackgroundColor: "rgb(54, 162, 235)",
          borderWidth: 2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      scale: {
        ticks: {
          beginAtZero: true,
          min: 0,
          max: 5,
          stepSize: 1,
          display: true,
        },
        pointLabels: {
          fontSize: 12,
        },
      },
      plugins: {
        legend: { display: false },
      },
      elements: {
        line: {
          tension: 0,
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `${getConfig().quickchartBaseUrl}/chart?c=${encoded}&w=400&h=400&f=png`;
}

export function buildMeetingChartUrl(scores: {
  goal_clarity: number;
  decision_made: number;
  todo_clarity: number;
  role_clarity: number;
  time_efficiency: number;
  participation_balance: number;
}): string {
  return generateRadarChartUrl({
    labels: [
      "目的の明確さ",
      "意思決定",
      "TODO明確化",
      "役割明確さ",
      "時間効率",
      "発言バランス",
    ],
    values: [
      scores.goal_clarity,
      scores.decision_made,
      scores.todo_clarity,
      scores.role_clarity,
      scores.time_efficiency,
      scores.participation_balance,
    ],
  });
}

export function buildIndividualChartUrl(scores: {
  issue_comprehension: number;
  value_density: number;
  structured_thinking: number;
  collaborative_influence: number;
  decision_drive: number;
  execution_linkage: number;
}): string {
  return generateRadarChartUrl({
    labels: [
      "課題理解度",
      "発言価値密度",
      "構造的思考",
      "協調的影響力",
      "意思決定推進",
      "実行連携度",
    ],
    values: [
      scores.issue_comprehension,
      scores.value_density,
      scores.structured_thinking,
      scores.collaborative_influence,
      scores.decision_drive,
      scores.execution_linkage,
    ],
  });
}

// --- Dynamic chart builders ---

import type { ScoringCriteria } from "../types/scoring-criteria.js";
import type { DynamicScores } from "../types/scoring-criteria.js";

export function buildDynamicChartUrl(
  scores: DynamicScores,
  criteria: ScoringCriteria[],
): string {
  const labels = criteria.map((c) => c.name_ja);
  const values = criteria.map((c) => scores[c.key] ?? 0);
  return generateRadarChartUrl({ labels, values });
}
