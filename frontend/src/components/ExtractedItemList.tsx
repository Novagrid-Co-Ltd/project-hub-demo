import { useState, useEffect, useCallback } from "react";
import type { Member } from "../mock/data";
import {
  confirmItem,
  rejectItem,
  updateItem as apiUpdateItem,
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  type ExtractedItemRow,
  type SubtaskRow,
} from "../lib/api";

interface MilestoneOption {
  id: string;
  name: string;
  due_date: string | null;
  phase_id: string | null;
}

interface Props {
  items: ExtractedItemRow[];
  members: Member[];
  milestones: MilestoneOption[];
  projectId: string;
  onRefresh: () => void;
}

type StatusFilter = "all" | "draft" | "confirmed" | "rejected";
type TypeFilter = "all" | "todo" | "decision" | "issue" | "phase_change";

const typeBadge: Record<ExtractedItemRow["type"], { label: string; cls: string }> = {
  todo: { label: "TODO", cls: "bg-corp-light text-corp-dark" },
  decision: { label: "決定事項", cls: "bg-green-100 text-green-800" },
  issue: { label: "課題", cls: "bg-red-100 text-red-800" },
  phase_change: { label: "フェーズ変更", cls: "bg-purple-100 text-purple-800" },
};

const priorityBadge: Record<ExtractedItemRow["priority"], { label: string; cls: string }> = {
  high: { label: "高", cls: "bg-red-100 text-red-700" },
  medium: { label: "中", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", cls: "bg-gray-100 text-gray-600" },
};

function SubtaskList({ itemId }: { itemId: string }) {
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSubtasks = useCallback(async () => {
    try {
      const data = await getSubtasks(itemId);
      setSubtasks(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [itemId]);

  useEffect(() => { fetchSubtasks(); }, [fetchSubtasks]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      await createSubtask(itemId, newContent.trim());
      setNewContent("");
      fetchSubtasks();
    } catch { alert("サブタスクの追加に失敗しました"); }
  };

  const handleToggle = async (st: SubtaskRow) => {
    try {
      await updateSubtask(st.id, { done: !st.done });
      fetchSubtasks();
    } catch { alert("更新に失敗しました"); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubtask(id);
      fetchSubtasks();
    } catch { alert("削除に失敗しました"); }
  };

  if (loading) return <div className="text-xs text-gray-400 mt-1">読み込み中...</div>;

  return (
    <div className="mt-2 ml-4 space-y-1">
      {subtasks.map((st) => (
        <div key={st.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={st.done}
            onChange={() => handleToggle(st)}
            className="accent-corp"
          />
          <span className={`text-xs flex-1 ${st.done ? "line-through text-gray-400" : "text-gray-700"}`}>
            {st.content}
          </span>
          <button
            className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
            onClick={() => handleDelete(st.id)}
          >
            x
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="border border-gray-200 rounded px-2 py-0.5 text-xs flex-1"
          placeholder="サブタスクを追加..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        {newContent && (
          <button className="text-xs text-corp hover:text-corp-dark" onClick={handleAdd}>追加</button>
        )}
      </div>
    </div>
  );
}

export default function ExtractedItemList({ items, members, milestones, onRefresh }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    content: string;
    assignee_member_id: string | null;
    due_date: string | null;
    priority: ExtractedItemRow["priority"];
    milestone_id: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Pending status changes (local draft before saving)
  const [pendingChanges, setPendingChanges] = useState<Map<string, "confirmed" | "rejected">>(new Map());

  const resolveName = (id: string | null): string => {
    if (!id) return "-";
    const m = members.find((x) => x.id === id);
    return m ? m.name : id;
  };

  const resolveMilestone = (id: string | null): string => {
    if (!id) return "-";
    const ms = milestones.find((x) => x.id === id);
    return ms ? ms.name : "-";
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
      milestone_id: item.milestone_id,
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

  const handleApprove = (item: ExtractedItemRow) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (next.get(item.id) === "confirmed") {
        next.delete(item.id); // toggle off
      } else {
        next.set(item.id, "confirmed");
      }
      return next;
    });
  };

  const handleReject = (item: ExtractedItemRow) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (next.get(item.id) === "rejected") {
        next.delete(item.id); // toggle off
      } else {
        next.set(item.id, "rejected");
      }
      return next;
    });
  };

  const savePendingChanges = async () => {
    if (pendingChanges.size === 0) return;
    setBusy(true);
    const errors: string[] = [];
    for (const [itemId, action] of pendingChanges) {
      try {
        if (action === "confirmed") {
          await confirmItem(itemId);
        } else {
          await rejectItem(itemId);
        }
      } catch (err) {
        errors.push(`${itemId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setPendingChanges(new Map());
    setBusy(false);
    if (errors.length > 0) {
      alert(`一部の保存に失敗しました:\n${errors.join("\n")}`);
    }
    onRefresh();
  };

  const discardPendingChanges = () => {
    setPendingChanges(new Map());
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
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
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

      {/* Pending changes bar */}
      {pendingChanges.size > 0 && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded px-4 py-2">
          <span className="text-sm text-yellow-800 font-medium">
            {pendingChanges.size}件の未保存の変更があります
          </span>
          <button
            disabled={busy}
            className="px-3 py-1 text-sm bg-corp text-white rounded hover:bg-corp-dark disabled:opacity-50"
            onClick={savePendingChanges}
          >
            {busy ? "保存中..." : "一括保存"}
          </button>
          <button
            disabled={busy}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={discardPendingChanges}
          >
            取り消し
          </button>
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">該当する項目がありません</p>
        )}
        {filtered.map((item) => {
          const isEditing = editingId === item.id;
          const isExpanded = expandedId === item.id;
          const pending = pendingChanges.get(item.id);
          const rowBg = pending === "confirmed"
            ? "bg-green-50 border-green-300"
            : pending === "rejected"
            ? "bg-red-50 border-red-300"
            : item.status === "draft" ? "bg-gray-50" : "bg-white";

          return (
            <div key={item.id} className={`border border-gray-200 rounded p-3 ${rowBg}`}>
              {isEditing && editDraft ? (
                /* Edit mode */
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${typeBadge[item.type].cls}`}>
                      {typeBadge[item.type].label}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">内容</label>
                    <textarea
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      rows={2}
                      value={editDraft.content}
                      onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <label className="text-xs text-gray-500">担当者</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.assignee_member_id ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, assignee_member_id: e.target.value || null })}
                      >
                        <option value="">未割当</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">期限</label>
                      <input
                        type="date"
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.due_date ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, due_date: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">優先度</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.priority}
                        onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value as ExtractedItemRow["priority"] })}
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">マイルストーン</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm block"
                        value={editDraft.milestone_id ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, milestone_id: e.target.value || null })}
                      >
                        <option value="">未割当</option>
                        {milestones.map((ms) => (
                          <option key={ms.id} value={ms.id}>{ms.name}{ms.due_date ? ` (${ms.due_date})` : ""}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={busy}
                      className="px-3 py-1 text-sm bg-corp text-white rounded hover:bg-corp-dark disabled:opacity-50"
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
                <div>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${typeBadge[item.type].cls}`}>
                          {typeBadge[item.type].label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${priorityBadge[item.priority].cls}`}>
                          {priorityBadge[item.priority].label}
                        </span>
                        {item.status === "confirmed" && !pending && (
                          <span className="text-green-600 text-sm" title="承認済み">&#10003;</span>
                        )}
                        {pending === "confirmed" && (
                          <span className="text-green-600 text-xs bg-green-100 px-1.5 py-0.5 rounded">承認予定</span>
                        )}
                        {pending === "rejected" && (
                          <span className="text-red-600 text-xs bg-red-100 px-1.5 py-0.5 rounded">却下予定</span>
                        )}
                      </div>
                      <p className={`text-sm ${item.status === "rejected" ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {item.content}
                      </p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500 items-center">
                        <span>担当: {resolveName(item.assignee_member_id)}</span>
                        {item.due_date && <span>期限: {item.due_date}</span>}
                        <span className="flex items-center gap-1">
                          MS:
                          <select
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs bg-white"
                            value={item.milestone_id ?? ""}
                            onChange={async (e) => {
                              try {
                                await apiUpdateItem(item.id, { milestone_id: e.target.value || null });
                                onRefresh();
                              } catch { alert("マイルストーン更新に失敗しました"); }
                            }}
                          >
                            <option value="">未割当</option>
                            {milestones.map((ms) => (
                              <option key={ms.id} value={ms.id}>{ms.name}</option>
                            ))}
                          </select>
                        </span>
                      </div>
                      {item.ai_original?.source_quote && (
                        <div className="mt-1 text-xs text-gray-400 italic border-l-2 border-gray-200 pl-2">
                          {item.ai_original.source_quote}
                        </div>
                      )}
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex gap-1 shrink-0 flex-wrap">
                      {item.type === "todo" && (
                        <button
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? "サブタスク閉" : "サブタスク"}
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
                      {item.status === "draft" && (
                        <>
                          {item.type === "phase_change" ? (
                            <button
                              disabled={busy}
                              className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
                                pending === "confirmed"
                                  ? "bg-purple-200 text-purple-800 ring-2 ring-purple-400"
                                  : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                              onClick={() => handleApprove(item)}
                            >
                              {pending === "confirmed" ? "承認取消" : "フェーズ更新を承認"}
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
                                pending === "confirmed"
                                  ? "bg-green-200 text-green-800 ring-2 ring-green-400"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                              onClick={() => handleApprove(item)}
                              title="承認"
                            >
                              {pending === "confirmed" ? "&#10003; 承認取消" : "&#10003; 承認"}
                            </button>
                          )}
                          <button
                            disabled={busy}
                            className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
                              pending === "rejected"
                                ? "bg-red-300 text-red-900 ring-2 ring-red-400"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                            onClick={() => handleReject(item)}
                            title="却下"
                          >
                            {pending === "rejected" ? "&#10007; 却下取消" : "&#10007; 却下"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Subtasks */}
                  {isExpanded && <SubtaskList itemId={item.id} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
