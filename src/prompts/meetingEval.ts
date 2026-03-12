export const PROMPT_VERSION = "meeting-eval-v1.1.0";

interface MeetingEvalPromptInput {
  eventSummary: string;
  eventStart: string;
  eventEnd: string;
  attendeeCount: number;
  charCount: number;
  transcript: string;
}

export function buildMeetingEvalPrompt(input: MeetingEvalPromptInput): string {
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

1. **goal_clarity**（目的の明確さ）— 会議の目的・ゴールが事前に明確に設定・共有されていたか。アジェンダが存在し、参加者が何を達成すべきか理解していたか。
2. **decision_made**（意思決定）— 議題に対して適切な意思決定がなされたか。決定プロセスは妥当で、合意形成が行われたか。
3. **todo_clarity**（TODO明確化）— 次のアクション（TODO）が具体的に定義され、担当者・期限が明確か。曖昧な「やっておく」で終わっていないか。
4. **role_clarity**（役割明確さ）— ファシリテーター・議事録係など参加者の役割が明確で機能していたか。進行役がいたか。
5. **time_efficiency**（時間効率）— 割り当て時間内で効率的に議論が進んだか。脱線・無駄な繰り返し・沈黙がなかったか。
6. **participation_balance**（発言バランス）— 参加者全員に発言機会があり、特定の人に偏っていなかったか。

## 出力フォーマット
以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。
各テキストフィールドは具体的かつ詳細に記述してください。

{
  "summary_scores": {
    "goal_clarity": <1-5>,
    "decision_made": <1-5>,
    "todo_clarity": <1-5>,
    "role_clarity": <1-5>,
    "time_efficiency": <1-5>,
    "participation_balance": <1-5>
  },
  "human_summary": {
    "headline": "<会議を一言で表すAI分析ヘッドライン（30文字以内）>",
    "overall_assessment": "<5〜8文の全体傾向分析。各スコアの根拠を織り交ぜながら、この会議が組織にとってどのような意味を持つかを含めて詳細に記述。良かった点と課題の両面から分析する>",
    "key_topics": ["<主な議題・トピック1: どのような内容が議論されたか1〜2文で>", "<議題2>", "<議題3>"],
    "strength_axis": "<6軸の中で最も高いスコアの軸名（英語キー名）>",
    "strength_reason": "<その軸が高い理由を3〜4文で具体的に。文字起こし内の具体的な発言や行動を引用しながら説明する>",
    "weakness_axis": "<6軸の中で最も低いスコアの軸名（英語キー名）>",
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
- strength_axis, weakness_axis は英語のキー名（goal_clarity, decision_made, todo_clarity, role_clarity, time_efficiency, participation_balance）で回答してください
- special_notes は必ず2個以上挙げてください
- 日本語で回答してください（キー名を除く）
- 抽象的な表現を避け、文字起こしの内容に基づいた具体的な記述を心がけてください

## 文字起こし
${input.transcript}`;
}
