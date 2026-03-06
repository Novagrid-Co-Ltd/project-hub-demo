import { useState, useRef, useEffect } from "react";
import type { Project, Member } from "../mock/data";
import { updateProject, addProjectMember, updateProjectMemberRole, removeProjectMember } from "../lib/api";

interface Props {
  project: Project;
  members: Member[];
  projectId: string;
  onSaved: () => void;
}

function InlineEdit({
  value,
  onSave,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-gray-100 px-1 rounded"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-gray-400">-</span>}
      </span>
    );
  }

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      type={type}
      className="border border-gray-300 rounded px-1 py-0.5 text-sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function InlineTextarea({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-gray-100 px-1 rounded"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-gray-400">-</span>}
      </span>
    );
  }

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <textarea
      ref={ref}
      className="border border-gray-300 rounded px-1 py-0.5 text-sm w-full"
      rows={3}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function InlineSelect({
  value,
  options,
  onSave,
}: {
  value: string;
  options: string[];
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-gray-100 px-1 rounded"
        onClick={() => setEditing(true)}
      >
        {value}
      </span>
    );
  }

  return (
    <select
      ref={ref}
      className="border border-gray-300 rounded px-1 py-0.5 text-sm"
      value={value}
      onChange={(e) => {
        onSave(e.target.value);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const statusLabels: Record<string, string> = {
  active: "進行中",
  on_hold: "保留",
  completed: "完了",
  archived: "アーカイブ",
};

export default function ProjectOverview({ project, members, projectId, onSaved }: Props) {
  const [localProject, setLocalProject] = useState(project);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

  useEffect(() => {
    setLocalProject(project);
  }, [project]);

  const save = async (patch: Record<string, unknown>) => {
    setLocalProject((prev) => ({ ...prev, ...patch }));
    try {
      await updateProject(projectId, patch);
      onSaved();
    } catch {
      setLocalProject(project);
    }
  };

  const resolveName = (memberId: string): string => {
    const m = members.find((x) => x.id === memberId);
    return m ? m.name : memberId;
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateProjectMemberRole(projectId, memberId, newRole);
      onSaved();
    } catch {
      alert("ロールの更新に失敗しました");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const name = resolveName(memberId);
    if (!confirm(`${name} をプロジェクトから削除しますか？`)) return;
    try {
      await removeProjectMember(projectId, memberId);
      onSaved();
    } catch {
      alert("メンバーの削除に失敗しました");
    }
  };

  const handleAddMember = async () => {
    if (!newMemberId) return;
    try {
      await addProjectMember(projectId, newMemberId, newMemberRole);
      setAddingMember(false);
      setNewMemberId("");
      setNewMemberRole("");
      onSaved();
    } catch {
      alert("メンバーの追加に失敗しました");
    }
  };

  // メンバー追加候補: 既にPJに入っているメンバーを除外
  const currentMemberIds = new Set(localProject.members.map((m) => m.member_id));
  const availableMembers = members.filter((m) => !currentMemberIds.has(m.id));

  return (
    <div className="space-y-6">
      {/* Project info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          プロジェクト情報
        </h3>
        <table className="text-sm w-full max-w-xl">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-600 w-28">名称</td>
              <td className="py-2">
                <InlineEdit
                  value={localProject.name}
                  onSave={(v) => save({ name: v })}
                />
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-600">説明</td>
              <td className="py-2">
                <InlineTextarea
                  value={localProject.description}
                  onSave={(v) => save({ description: v })}
                />
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-600">
                ステータス
              </td>
              <td className="py-2">
                <InlineSelect
                  value={localProject.status}
                  options={["active", "on_hold", "completed", "archived"]}
                  onSave={(v) => save({ status: v })}
                />
                <span className="ml-2 text-xs text-gray-400">
                  ({statusLabels[localProject.status]})
                </span>
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-600">期間</td>
              <td className="py-2">
                <InlineEdit
                  value={localProject.start_date}
                  onSave={(v) => save({ start_date: v })}
                  type="date"
                />
                <span className="mx-1">~</span>
                <InlineEdit
                  value={localProject.end_date}
                  onSave={(v) => save({ end_date: v })}
                  type="date"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-500">メンバー</h3>
          {!addingMember && (
            <button
              className="text-xs text-corp hover:text-corp-dark"
              onClick={() => setAddingMember(true)}
            >
              + メンバー追加
            </button>
          )}
        </div>
        <table className="text-sm w-full max-w-xl">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 pr-4 font-medium">名前</th>
              <th className="py-1 font-medium">役割</th>
              <th className="py-1 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {localProject.members.map((pm) => (
              <tr key={pm.member_id} className="border-b border-gray-100 group">
                <td className="py-2 pr-4">{resolveName(pm.member_id)}</td>
                <td className="py-2">
                  <InlineEdit
                    value={pm.role}
                    onSave={(v) => handleRoleChange(pm.member_id, v)}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveMember(pm.member_id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}

            {/* Add member row */}
            {addingMember && (
              <tr className="border-b border-gray-100 bg-corp-light">
                <td className="py-2 pr-4">
                  <select
                    className="border border-gray-300 rounded px-1 py-0.5 text-sm w-full"
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {availableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    className="border border-gray-300 rounded px-1 py-0.5 text-sm w-full"
                    placeholder="役割（例: PM, Engineer）"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddMember();
                      if (e.key === "Escape") setAddingMember(false);
                    }}
                  />
                </td>
                <td className="py-2 text-right space-x-1">
                  <button
                    className="text-xs text-corp hover:text-corp-dark"
                    onClick={handleAddMember}
                  >
                    追加
                  </button>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      setAddingMember(false);
                      setNewMemberId("");
                      setNewMemberRole("");
                    }}
                  >
                    取消
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
