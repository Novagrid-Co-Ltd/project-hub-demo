import { useState } from "react";
import { previewPrompt } from "../lib/api";

interface Props {
  type: "meeting" | "individual";
}

export default function PromptPreview({ type }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [criteriaCount, setCriteriaCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await previewPrompt(type);
      setPrompt(data.prompt);
      setCriteriaCount(data.criteriaCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プレビュー生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">プロンプトプレビュー</h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "生成中..." : "プレビュー生成"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
          {error}
        </div>
      )}

      {prompt && (
        <>
          <p className="text-sm text-gray-500 mb-2">
            有効な採点軸: {criteriaCount}個
          </p>
          <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap">
            {prompt}
          </pre>
        </>
      )}

      {!prompt && !loading && (
        <p className="text-sm text-gray-400">
          「プレビュー生成」をクリックすると、現在の有効な採点軸から自動生成されるLLMプロンプトを確認できます。
        </p>
      )}
    </div>
  );
}
