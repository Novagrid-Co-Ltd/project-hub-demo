import { useState, useEffect, useCallback } from "react";
import type { ScoringCriteriaRow } from "../lib/api";
import { getCriteria } from "../lib/api";
import CriteriaList from "../components/CriteriaList";
import CriteriaForm from "../components/CriteriaForm";
import PromptPreview from "../components/PromptPreview";

type TabType = "meeting" | "individual";

export default function CriteriaEditor() {
  const [tab, setTab] = useState<TabType>("meeting");
  const [criteria, setCriteria] = useState<ScoringCriteriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScoringCriteriaRow | null>(null);

  const fetchCriteria = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCriteria({ type: tab });
      setCriteria(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load criteria");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchCriteria();
  }, [fetchCriteria]);

  const handleEdit = (c: ScoringCriteriaRow) => {
    setEditing(c);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchCriteria();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const activeCriteria = criteria.filter((c) => c.is_active);
  const inactiveCriteria = criteria.filter((c) => !c.is_active);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">採点軸エディタ</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-corp text-white rounded-lg text-sm hover:bg-corp-dark"
        >
          + 新規追加
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => { setTab("meeting"); setShowForm(false); setEditing(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "meeting"
              ? "border-corp text-corp"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          会議評価 ({criteria.filter(c => c.type === "meeting" || tab === "meeting").length > 0 ? activeCriteria.length : 0})
        </button>
        <button
          onClick={() => { setTab("individual"); setShowForm(false); setEditing(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "individual"
              ? "border-corp text-corp"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          個人評価 ({tab === "individual" ? activeCriteria.length : 0})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6">
          <CriteriaForm
            type={tab}
            editing={editing}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-500 text-sm py-4">読み込み中...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              有効な採点軸 ({activeCriteria.length})
            </h2>
            <CriteriaList
              criteria={activeCriteria}
              onEdit={handleEdit}
              onRefresh={fetchCriteria}
            />
          </div>

          {inactiveCriteria.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-3">
                無効な採点軸 ({inactiveCriteria.length})
              </h2>
              <CriteriaList
                criteria={inactiveCriteria}
                onEdit={handleEdit}
                onRefresh={fetchCriteria}
              />
            </div>
          )}

          {/* Prompt Preview */}
          <div className="mt-8">
            <PromptPreview type={tab} />
          </div>
        </div>
      )}
    </div>
  );
}
