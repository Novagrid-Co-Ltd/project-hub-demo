import { useState, useEffect } from "react";
import type { ScoringCriteriaRow } from "../lib/api";
import { createCriteria, updateCriteria } from "../lib/api";

interface Props {
  type: "meeting" | "individual";
  editing: ScoringCriteriaRow | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function CriteriaForm({ type, editing, onSaved, onCancel }: Props) {
  const [key, setKey] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [descriptionJa, setDescriptionJa] = useState("");
  const [weight, setWeight] = useState(1.0);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setKey(editing.key);
      setNameJa(editing.name_ja);
      setDescriptionJa(editing.description_ja);
      setWeight(editing.weight);
      setSortOrder(editing.sort_order);
    } else {
      setKey("");
      setNameJa("");
      setDescriptionJa("");
      setWeight(1.0);
      setSortOrder(0);
    }
    setError(null);
  }, [editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (editing) {
        await updateCriteria(editing.id, {
          name_ja: nameJa,
          description_ja: descriptionJa,
          weight,
          sort_order: sortOrder,
        });
      } else {
        if (!key.match(/^[a-z][a-z0-9_]*$/)) {
          throw new Error("キーは英小文字・数字・アンダースコアのみ（先頭は英字）");
        }
        await createCriteria({
          type,
          key,
          name_ja: nameJa,
          description_ja: descriptionJa,
          weight,
          sort_order: sortOrder,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-corp/30 rounded-lg p-4 bg-corp-light space-y-3">
      <h3 className="font-semibold text-gray-900">
        {editing ? `編集: ${editing.name_ja}` : "新規採点軸を追加"}
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">キー (英字)</label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!!editing}
            placeholder="goal_clarity"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm disabled:bg-gray-100"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名前 (日本語)</label>
          <input
            type="text"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
            placeholder="目的の明確さ"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">説明 (LLMプロンプトに使用)</label>
        <textarea
          value={descriptionJa}
          onChange={(e) => setDescriptionJa(e.target.value)}
          placeholder="会議の目的・ゴールが事前に明確に設定・共有されていたか..."
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm h-20 resize-y"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">重み</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-corp text-white rounded text-sm hover:bg-corp-dark disabled:opacity-50"
        >
          {saving ? "保存中..." : editing ? "更新" : "追加"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
