export const PROMPT_VERSION = "individual-eval-v1.1.0";

interface IndividualEvalPromptInput {
  displayName: string;
  email: string;
  eventSummary: string;
  eventStart: string;
  eventEnd: string;
  attendeeCount: number;
  transcript: string;
}

export function buildIndividualEvalPrompt(input: IndividualEvalPromptInput): string {
  return `あなたは会議における個人の貢献度を評価する専門コンサルタントです。以下の会議の文字起こしを詳細に分析し、指定された参加者の貢献を評価してください。
各フィールドは具体的かつ十分な文量で記述し、抽象的な表現は避けてください。

## 会議メタデータ
- 会議名: ${input.eventSummary}
- 開始: ${input.eventStart}
- 終了: ${input.eventEnd}
- 参加者数: ${input.attendeeCount}名

## 評価対象者
- 氏名: ${input.displayName}
- メール: ${input.email}

## 評価基準
各項目を1〜5点で評価してください（1=非常に悪い、5=非常に良い）:

1. **issue_comprehension**（課題理解度）— 議題・課題の本質をどの程度正確に理解し、的確な発言をしていたか。表面的な理解にとどまらず、根本原因や影響範囲まで把握していたか。
2. **value_density**（発言価値密度）— 発言の質が高く、議論に実質的な価値を提供していたか。情報提供、問題提起、解決策の提案など、発言の中身が充実していたか（量より質）。
3. **structured_thinking**（構造的思考）— 発言が論理的に整理されており、わかりやすく構造化されていたか。因果関係や優先順位を明確にしながら話していたか。
4. **collaborative_influence**（協調的影響力）— 他の参加者の意見を活かし、建設的な議論の展開に貢献していたか。対立意見への対応や、チーム全体の議論の質を高める行動があったか。
5. **decision_drive**（意思決定推進）— 議論を意思決定に向けて推進し、合意形成に貢献していたか。議論が堂々巡りになった際に方向性を示したか。
6. **execution_linkage**（実行連携度）— 議論を具体的なアクション・タスクに結びつけ、実行可能な提案をしていたか。「次に何をするか」を明確にする発言があったか。

## 出力フォーマット
以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。
各テキストフィールドは具体的かつ詳細に記述してください。

{
  "scores": {
    "issue_comprehension": <1-5>,
    "value_density": <1-5>,
    "structured_thinking": <1-5>,
    "collaborative_influence": <1-5>,
    "decision_drive": <1-5>,
    "execution_linkage": <1-5>
  },
  "evidence": {
    "quotes": [
      "<文字起こしからの直接引用1 — この発言がどの評価軸に関連するか>",
      "<直接引用2>",
      "<直接引用3>"
    ],
    "notes": [
      "<この人物の参加に関する客観的な観察1: 具体的な行動や発言パターンを2文以上で>",
      "<観察2>",
      "<観察3>"
    ]
  },
  "strengths": [
    "<この人物の強み1: 会議中のどの場面でどのように発揮されたか具体的に>",
    "<強み2>"
  ],
  "improvements": [
    "<改善提案1: 何を、どのように改善すればより効果的な参加ができるか具体的に>",
    "<改善提案2>"
  ],
  "communication_style": "<この人物のコミュニケーションスタイルを3〜4文で分析。発言の傾向、他者との関わり方、議論へのアプローチの特徴を記述>",
  "summary": "<この人物の貢献を5〜8文で総合的に評価。スコアの根拠を含めて、強みと改善点の両面から詳細に記述する>"
}

## 注意事項
- スコアは必ず1〜5の整数で回答してください
- evidence.quotes は文字起こし内の実際の発言を3個以上引用してください
- evidence.notes は客観的な観察を2個以上記述してください
- strengths は具体的な強みを2個以上挙げてください
- improvements は建設的な改善提案を1個以上挙げてください
- communication_style は必ず3文以上で記述してください
- summary は必ず5文以上で詳細に記述してください
- 日本語で回答してください
- 対象者の発言が少ない・見つからない場合でも、会議への参加態度から推測して評価してください
- 抽象的な表現を避け、文字起こしの内容に基づいた具体的な記述を心がけてください

## 文字起こし
${input.transcript}`;
}
