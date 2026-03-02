export const EXTRACTION_PROMPT_VERSION = "extraction-v2.0.0";

export interface ProjectContext {
  name: string;
  members: { name: string; role: string }[];
  phases: { name: string; status: string }[];
}

export function buildExtractionPrompt(transcript: string, projectInfo: ProjectContext): string {
  const membersBlock = projectInfo.members.map((m) => `- ${m.name}（${m.role}）`).join("\n");
  const phasesBlock = projectInfo.phases.map((p) => `- ${p.name}: ${p.status}`).join("\n");

  return `あなたは会議の議事録を分析し、プロジェクト管理に必要な構造化データを抽出するAIです。

## 対象プロジェクト
プロジェクト名: ${projectInfo.name}
メンバー:
${membersBlock}

現在のフェーズ:
${phasesBlock}

## 議事録
${transcript}

## 抽出ルール

以下のJSON形式で出力してください。JSONのみ出力し、他のテキストは一切含めないでください。

{
  "items": [
    {
      "type": "todo | decision | issue | phase_change",
      "content": "内容の要約（1〜2文、簡潔に）",
      "assignee": "担当者名（メンバー一覧の名前と一致させること。不明ならnull）",
      "due_date": "YYYY-MM-DD（言及がなければnull）",
      "priority": "high | medium | low",
      "source_quote": "根拠となる議事録の発言（原文ママ、1文）",
      "phase_completed": "完了したフェーズ名（phase_changeの場合のみ。該当なければnull）",
      "phase_started": "開始するフェーズ名（phase_changeの場合のみ。該当なければnull）"
    }
  ],
  "milestones": [
    {
      "name": "マイルストーン名",
      "due_date": "YYYY-MM-DD",
      "phase_name": "関連するフェーズ名（該当なければnull）",
      "source_quote": "根拠となる発言"
    }
  ]
}

### 各typeの判定基準

**todo（アクションアイテム）**
- 「〜する」「〜を準備する」「〜を確認する」「〜までに対応する」等、具体的なアクションが必要な発言
- 担当者が明示されていなくても、発言者が自ら行うと読み取れる場合は発言者を担当者とする
- 曖昧な「検討する」程度のものは抽出しない

**decision（決定事項）**
- 「〜に決定」「〜で行く」「〜を採用する」「〜で合意」等、明確な合意が形成された内容
- 単なる意見や提案ではなく、参加者間で合意に至ったもののみ

**issue（課題・リスク）**
- 「〜が心配」「〜がリスク」「〜が間に合わない」「〜がボトルネック」等、解決すべき問題や懸念
- 既に解決済みの過去の課題は抽出しない

**phase_change（フェーズの変化）**
- 「〜フェーズが完了した」「〜に移行する」「〜を始める」等、プロジェクトフェーズの遷移を示す発言
- 現在のフェーズ一覧を参照し、実在するフェーズ名と照合すること
- 出力にphase_completedとphase_startedを含めること

### milestone検知
- 具体的な期日と成果物・達成目標がセットで言及されている場合に抽出
- 既に登録済みのマイルストーンとの重複は気にしなくてよい（アプリ側で処理する）

### 共通ルール
- 担当者名は必ずメンバー一覧の名前と完全一致させること。一覧にない名前は使わないこと
- 議事録の言語に関わらず、出力は日本語で統一すること
- 曖昧な発言は無理に抽出しない。確信度の高いもののみ抽出すること
- source_quoteは議事録内の実際の発言を引用すること（要約や改変はしない）
- itemsが0件の場合は空配列を返すこと
- milestonesが0件の場合は空配列を返すこと`;
}
