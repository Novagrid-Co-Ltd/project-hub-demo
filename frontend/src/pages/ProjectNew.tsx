import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMembers, createProject, type MemberRow } from "../lib/api";

interface PhaseRow {
  tempId: string;
  name: string;
  start_date: string;
  end_date: string;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProjectNew() {
  const navigate = useNavigate();

  const [allMembers, setAllMembers] = useState<MemberRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Calendar keywords (tag input)
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // Members
  const [members, setMembers] = useState<
    { member_id: string; role: string; name: string }[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("");

  // Phases
  const [phases, setPhases] = useState<PhaseRow[]>([]);

  useEffect(() => {
    getMembers().then((data) => {
      setAllMembers(data);
      if (data.length > 0) setSelectedMemberId(data[0].id);
    });
  }, []);

  // --- Keyword handlers ---
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = keywordInput.trim();
      if (trimmed && !keywords.includes(trimmed)) {
        setKeywords((prev) => [...prev, trimmed]);
      }
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) =>
    setKeywords((prev) => prev.filter((k) => k !== kw));

  // --- Member handlers ---
  const addMember = () => {
    if (!selectedMemberId || !memberRole.trim()) return;
    if (members.some((m) => m.member_id === selectedMemberId)) return;
    const member = allMembers.find((m) => m.id === selectedMemberId);
    if (!member) return;
    setMembers((prev) => [
      ...prev,
      {
        member_id: member.id,
        role: memberRole.trim(),
        name: member.display_name,
      },
    ]);
    setMemberRole("");
  };

  const removeMember = (memberId: string) =>
    setMembers((prev) => prev.filter((m) => m.member_id !== memberId));

  // --- Phase handlers ---
  const addPhaseRow = () =>
    setPhases((prev) => [
      ...prev,
      { tempId: randomId(), name: "", start_date: "", end_date: "" },
    ]);

  const removePhaseRow = (tempId: string) =>
    setPhases((prev) => prev.filter((p) => p.tempId !== tempId));

  const updatePhase = (
    tempId: string,
    field: keyof Omit<PhaseRow, "tempId">,
    value: string
  ) =>
    setPhases((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p))
    );

  const movePhase = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= phases.length) return;
    setPhases((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
        calendar_keywords: keywords,
        start_date: startDate || null,
        end_date: endDate || null,
        members: members.map(({ member_id, role }) => ({ member_id, role })),
        phases: phases.map((p, i) => ({
          name: p.name,
          sort_order: i + 1,
          start_date: p.start_date || null,
          end_date: p.end_date || null,
        })),
      });
      navigate("/projects");
    } catch (err) {
      alert(
        `保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新規PJ作成</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* PJ名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PJ名 *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Calendar keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Calendar keywords
          </label>
          <div className="flex flex-wrap gap-1 mb-1">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="text-blue-500 hover:text-blue-700 cursor-pointer"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="Enter で追加"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* 説明 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            説明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* 日付 */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了予定日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* メンバー追加 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メンバー追加
          </label>
          <div className="flex gap-2 mb-2">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {allMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="役割"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
            />
            <button
              type="button"
              onClick={addMember}
              className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300 cursor-pointer"
            >
              追加
            </button>
          </div>
          {members.length > 0 && (
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.member_id}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-1 text-sm"
                >
                  <span>
                    {m.name} - {m.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMember(m.member_id)}
                    className="text-red-500 hover:text-red-700 cursor-pointer text-xs"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* フェーズ追加 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            フェーズ
          </label>
          <div className="space-y-2 mb-2">
            {phases.map((phase, index) => (
              <div key={phase.tempId} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => movePhase(index, -1)}
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
                  >
                    &#9650;
                  </button>
                  <button
                    type="button"
                    disabled={index === phases.length - 1}
                    onClick={() => movePhase(index, 1)}
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
                  >
                    &#9660;
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="フェーズ名"
                  value={phase.name}
                  onChange={(e) =>
                    updatePhase(phase.tempId, "name", e.target.value)
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                />
                <input
                  type="date"
                  value={phase.start_date}
                  onChange={(e) =>
                    updatePhase(phase.tempId, "start_date", e.target.value)
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  value={phase.end_date}
                  onChange={(e) =>
                    updatePhase(phase.tempId, "end_date", e.target.value)
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removePhaseRow(phase.tempId)}
                  className="text-red-500 hover:text-red-700 cursor-pointer text-sm"
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPhaseRow}
            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            ＋ フェーズ追加
          </button>
        </div>

        {/* 保存 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
