import { useState } from "react";
import type { ScoringCriteriaRow } from "../lib/api";
import { updateCriteria } from "../lib/api";

interface Props {
  criteria: ScoringCriteriaRow[];
  onEdit: (c: ScoringCriteriaRow) => void;
  onRefresh: () => void;
}

export default function CriteriaList({ criteria, onEdit, onRefresh }: Props) {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (c: ScoringCriteriaRow) => {
    setToggling(c.id);
    try {
      await updateCriteria(c.id, { is_active: !c.is_active });
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error toggling criteria");
    } finally {
      setToggling(null);
    }
  };

  if (criteria.length === 0) {
    return <p className="text-gray-500 text-sm py-4">採点軸がありません</p>;
  }

  return (
    <div className="space-y-2">
      {criteria.map((c) => (
        <div
          key={c.id}
          className={`border rounded-lg p-4 ${c.is_active ? "bg-white border-gray-200" : "bg-gray-50 border-gray-300 opacity-60"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-corp bg-corp-light px-2 py-0.5 rounded">
                  {c.key}
                </span>
                <span className="font-semibold text-gray-900">{c.name_ja}</span>
                <span className="text-xs text-gray-400">order: {c.sort_order}</span>
                <span className="text-xs text-gray-400">weight: {c.weight}</span>
                {!c.is_active && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">無効</span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{c.description_ja}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(c)}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                編集
              </button>
              <button
                onClick={() => handleToggle(c)}
                disabled={toggling === c.id}
                className={`px-3 py-1.5 text-sm rounded ${
                  c.is_active
                    ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                } disabled:opacity-50`}
              >
                {toggling === c.id ? "..." : c.is_active ? "無効化" : "有効化"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
