import type { ScoringCriteria } from "../types/scoring-criteria.js";

export const DYNAMIC_PROMPT_VERSION = "meeting-eval-dynamic-v1.0.0";

interface DynamicMeetingEvalPromptInput {
  eventSummary: string;
  eventStart: string;
  eventEnd: string;
  attendeeCount: number;
  charCount: number;
  transcript: string;
}

export function buildDynamicMeetingEvalPrompt(
  criteria: ScoringCriteria[],
  input: DynamicMeetingEvalPromptInput,
): string {
  // Build criteria section
  const criteriaLines = criteria
    .map((c, i) => `${i + 1}. **${c.key}**（${c.name_ja}）— ${c.description_ja}`)
    .join("\n");

  // Build JSON scores template
  const scoresTemplate = criteria
    .map((c) => `    "${c.key}": <1-5>`)
    .join(",\n");

  // Build valid axis keys for strength/weakness
  const axisKeys = criteria.map((c) => c.key).join(", ");

  return `あなたは会議効率化コンサルタントとして、以下の会議の文字起こしを詳細に分析し、構造化された評価レポートを作成してください。
各フィールドは具体的かつ十分な文量で記述し、抽象的な表現は避けてください。

## 会議メタデータ
- 会議名: ${input.eventSummary}
- 開始: ${input.eventStart}
- 終了: ${input.eventEnd}
- 参加者数: ${input.attendeeCount}名
- 文字数: ${input.charCount}文字

## 評価基準
各項目を1〜5点で評価してください（1=非常に悪い、5=非常に良い）:

${criteriaLines}

## 出力フォーマット
以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。
各テキストフィールドは具体的かつ詳細に記述してください。

{
  "summary_scores": {
${scoresTemplate}
  },
  "human_summary": {
    "headline": "<会議を一言で表すAI分析ヘッドライン（30文字以内）>",
    "overall_assessment": "<5〜8文の全体傾向分析。各スコアの根拠を織り交ぜながら、この会議が組織にとってどのような意味を持つかを含めて詳細に記述。良かった点と課題の両面から分析する>",
    "key_topics": ["<主な議題・トピック1: どのような内容が議論されたか1〜2文で>", "<議題2>", "<議題3>"],
    "strength_axis": "<評価軸の中で最も高いスコアの軸名（英語キー名）>",
    "strength_reason": "<その軸が高い理由を3〜4文で具体的に。文字起こし内の具体的な発言や行動を引用しながら説明する>",
    "weakness_axis": "<評価軸の中で最も低いスコアの軸名（英語キー名）>",
    "weakness_reason": "<その軸が低い理由を3〜4文で具体的に。何が不足していたか、どのような場面で問題が顕在化したかを説明する>",
    "special_notes": [
      "<特筆すべき観察事項1: 会議中に見られた注目すべきパターンや行動を2文以上で>",
      "<特筆すべき観察事項2>",
      "<特筆すべき観察事項3>"
    ],
    "decisions": ["<決定事項1: 何が決まり、その背景は何か>", "<決定事項2>"],
    "action_items": [
      "[high] <具体的なアクション内容と期限（担当者: 名前）— なぜhighか簡潔に>",
      "[medium] <アクション内容（担当者: 名前）>",
      "[low] <アクション内容（担当者: 名前）>"
    ],
    "recommendations": [
      "<次回以降の会議に向けた具体的な改善提言1: 何を、どのように改善すべきか2〜3文で>",
      "<改善提言2>",
      "<改善提言3>"
    ],
    "participation_note": "<発言バランスに関する詳細分析。誰がどの程度発言していたか、偏りの具体的な状況、改善のための具体的な提案を3〜5文で>"
  }
}

## 注意事項
- スコアは必ず1〜5の整数で回答してください
- headline は30文字以内の日本語で
- overall_assessment は必ず5文以上で詳細に書いてください
- key_topics は議論された主な議題を2〜5個挙げてください
- action_items の各項目は先頭に [high], [medium], [low] のいずれかの優先度をつけてください
- recommendations は次回の会議改善に向けた具体的な提言を2〜4個挙げてください
- strength_axis, weakness_axis は以下の英語キー名のいずれかで回答してください: ${axisKeys}
- special_notes は必ず2個以上挙げてください
- 日本語で回答してください（キー名を除く）
- 抽象的な表現を避け、文字起こしの内容に基づいた具体的な記述を心がけてください

## 文字起こし
${input.transcript}`;
}
