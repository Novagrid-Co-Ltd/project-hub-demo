import { useState } from "react";
import type { Member } from "../mock/data";
import {
  confirmItem,
  rejectItem,
  updateItem as apiUpdateItem,
  type ExtractedItemRow,
} from "../lib/api";

interface Props {
  items: ExtractedItemRow[];
  members: Member[];
  projectId: string;
  onRefresh: () => void;
}

type StatusFilter = "all" | "draft" | "confirmed" | "rejected";
type TypeFilter = "all" | "todo" | "decision" | "issue" | "phase_change";

const typeBadge: Record<
  ExtractedItemRow["type"],
  { label: string; cls: string }
> = {
  todo: { label: "TODO", cls: "bg-blue-100 text-blue-800" },
  decision: { label: "決定事項", cls: "bg-green-100 text-green-800" },
  issue: { label: "課題", cls: "bg-red-100 text-red-800" },
  phase_change: {
    label: "フェーズ変更",
    cls: "bg-purple-100 text-purple-800",
  },
};

const priorityBadge: Record<
  ExtractedItemRow["priority"],
  { label: string; cls: string }
> = {
  high: { label: "高", cls: "bg-red-100 text-red-700" },
  medium: { label: "中", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", cls: "bg-gray-100 text-gray-600" },
};

export default function ExtractedItemList({
  items,
  members,
  onRefresh,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    content: string;
    assignee_member_id: string | null;
    due_date: string | null;
    priority: ExtractedItemRow["priority"];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const resolveName = (id: string | null): string => {
    if (!id) return "-";
    const m = members.find((x) => x.id === id);
    return m ? m.name : id;
  };

  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    return true;
  });

  const startEdit = (item: ExtractedItemRow) => {
    setEditingId(item.id);
    setEditDraft({
      content: item.content,
      assignee_member_id: item.assignee_member_id,
      due_date: item.due_date,
      priority: item.priority,
    });
  };

  const saveEdit = async (id: string) => {
    if (!editDraft) return;
    setBusy(true);
    try {
      await apiUpdateItem(id, editDraft);
      setEditingId(null);
      setEditDraft(null);
      onRefresh();
    } catch (err) {
      alert(`保存に失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleApprove = async (item: ExtractedItemRow) => {
    setBusy(true);
    try {
      await confirmItem(item.id);
      onRefresh();
    } catch (err) {
      alert(`承認に失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (item: ExtractedItemRow) => {
    setBusy(true);
    try {
      await rejectItem(item.id);
      onRefresh();
    } catch (err) {
      alert(`却下に失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">ステータス:</span>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StatusFilter)
            }
          >
            <option value="all">すべて</option>
            <option value="draft">下書き</option>
            <option value="confirmed">承認済み</option>
            <option value="rejected">却下</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">種別:</span>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">すべて</option>
            <option value="todo">TODO</option>
            <option value="decision">決定事項</option>
            <option value="issue">課題</option>
            <option value="phase_change">フェーズ変更</option>
          </select>
        </div>
        <span className="text-xs text-gray-400">{filtered.length}件表示</span>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            該当する項目がありません
          </p>
        )}
        {filtered.map((item) => {
          const isEditing = editingId === item.id;
          const rowBg = item.status === "draft" ? "bg-gray-50" : "bg-white";

          return (
            <div
              key={item.id}
              className={`border border-gray-200 rounded p-3 ${rowBg}`}
            >
              {isEditing && editDraft ? (
                /* Edit mode */
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${typeBadge[item.type].cls}`}
                    >
                      {typeBadge[item.type].label}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">内容</label>
                    <textarea
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      rows={2}
                      value={editDraft.content}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, content: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <label className="text-xs text-gray-500">担当者</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.assignee_member_id ?? ""}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            assignee_member_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">未割当</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">期限</label>
                      <input
                        type="date"
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.due_date ?? ""}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            due_date: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">優先度</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.priority}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            priority: e.target
                              .value as ExtractedItemRow["priority"],
                          })
                        }
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={busy}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      onClick={() => saveEdit(item.id)}
                    >
                      保存
                    </button>
                    <button
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      onClick={cancelEdit}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-start gap-3">
                  {/* Left: type badge + content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${typeBadge[item.type].cls}`}
                      >
                        {typeBadge[item.type].label}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${priorityBadge[item.priority].cls}`}
                      >
                        {priorityBadge[item.priority].label}
                      </span>
                      {item.status === "confirmed" && (
                        <span
                          className="text-green-600 text-sm"
                          title="承認済み"
                        >
                          &#10003;
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${item.status === "rejected" ? "line-through text-gray-400" : "text-gray-800"}`}
                    >
                      {item.content}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>
                        担当: {resolveName(item.assignee_member_id)}
                      </span>
                      {item.due_date && <span>期限: {item.due_date}</span>}
                    </div>
                    {item.ai_original?.source_quote && (
                      <div className="mt-1 text-xs text-gray-400 italic border-l-2 border-gray-200 pl-2">
                        {item.ai_original.source_quote}
                      </div>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  {item.status === "draft" && (
                    <div className="flex gap-1 shrink-0">
                      {item.type === "phase_change" ? (
                        <button
                          disabled={busy}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                          onClick={() => handleApprove(item)}
                        >
                          フェーズ更新を承認
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          onClick={() => handleApprove(item)}
                          title="承認"
                        >
                          &#10003; 承認
                        </button>
                      )}
                      <button
                        disabled={busy}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        onClick={() => startEdit(item)}
                        title="修正"
                      >
                        &#9998; 修正
                      </button>
                      <button
                        disabled={busy}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        onClick={() => handleReject(item)}
                        title="却下"
                      >
                        &#10007; 却下
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
