import { useMemo, useState, useCallback } from "react";
import type { Project, Member } from "../mock/data";
import type { ExtractedItemRow } from "../lib/api";
import { createPhase, updatePhase, deletePhase, createMilestone, updateMilestone, deleteMilestone } from "../lib/api";

type PendingPatch = Record<string, unknown>;

interface Props {
  project: Project;
  projectId: string;
  items: ExtractedItemRow[];
  members: Member[];
  onRefresh: () => void;
}

const DAY_MS = 86400000;
const LABEL_WIDTH = 150;

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatMonth(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  completed: "完了",
};

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-gray-400",
  in_progress: "bg-corp",
  completed: "bg-green-500",
};

const typeBadge: Record<string, { label: string; cls: string }> = {
  todo: { label: "TODO", cls: "bg-corp-light text-corp-dark" },
  decision: { label: "決定事項", cls: "bg-green-100 text-green-800" },
  issue: { label: "課題", cls: "bg-red-100 text-red-800" },
  phase_change: { label: "フェーズ変更", cls: "bg-purple-100 text-purple-800" },
};

export default function GanttChart({ project, projectId, items, members, onRefresh }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [addingPhase, setAddingPhase] = useState(false);
  const [addingMsPhaseId, setAddingMsPhaseId] = useState<string | null>(null);
  const [newPhase, setNewPhase] = useState({ name: "", start_date: "", end_date: "" });
  const [newMs, setNewMs] = useState({ name: "", due_date: "" });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pendingPhases, setPendingPhases] = useState<Record<string, PendingPatch>>({});
  const [pendingMilestones, setPendingMilestones] = useState<Record<string, PendingPatch>>({});
  const [saving, setSaving] = useState(false);

  const hasPendingChanges = Object.keys(pendingPhases).length > 0 || Object.keys(pendingMilestones).length > 0;

  const togglePhase = (id: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Only show confirmed TODOs and decisions
  const confirmedItems = items.filter(
    (item) => item.status === "confirmed" && (item.type === "todo" || item.type === "decision")
  );

  const resolveName = (id: string | null): string => {
    if (!id) return "-";
    const m = members.find((x) => x.id === id);
    return m ? m.name : id;
  };

  // Build nested structure: Phase > Milestone > Items (decisions first, then TODOs)
  const nestedData = useMemo(() => {
    const phasesArr = [...patchedProject.phases].sort((a, b) => a.sort_order - b.sort_order);

    // Group milestones by phase
    const msByPhase: Record<string, typeof patchedProject.milestones> = {};
    const unmatchedMs: typeof patchedProject.milestones = [];
    for (const ms of patchedProject.milestones) {
      if (ms.phase_id) {
        if (!msByPhase[ms.phase_id]) msByPhase[ms.phase_id] = [];
        msByPhase[ms.phase_id].push(ms);
      } else {
        unmatchedMs.push(ms);
      }
    }

    // Group items into phases by due_date range
    const itemsByPhase: Record<string, ExtractedItemRow[]> = {};
    const unmatchedItems: ExtractedItemRow[] = [];
    for (const item of confirmedItems) {
      if (!item.due_date) { unmatchedItems.push(item); continue; }
      const itemDate = parseDate(item.due_date);
      let matched = false;
      for (const phase of phasesArr) {
        if (!phase.start_date || !phase.end_date) continue;
        if (itemDate >= parseDate(phase.start_date) && itemDate <= parseDate(phase.end_date)) {
          if (!itemsByPhase[phase.id]) itemsByPhase[phase.id] = [];
          itemsByPhase[phase.id].push(item);
          matched = true;
          break;
        }
      }
      if (!matched) unmatchedItems.push(item);
    }

    // Within each phase, assign items to nearest milestone by due_date
    function assignItemsToMilestones(
      milestones: typeof project.milestones,
      phaseItems: ExtractedItemRow[]
    ): { msItems: Record<string, ExtractedItemRow[]>; orphanItems: ExtractedItemRow[] } {
      const msItems: Record<string, ExtractedItemRow[]> = {};
      const orphanItems: ExtractedItemRow[] = [];
      const msWithDates = milestones.filter((m) => m.due_date).sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1));

      if (msWithDates.length === 0) return { msItems, orphanItems: phaseItems };

      for (const item of phaseItems) {
        if (!item.due_date) { orphanItems.push(item); continue; }
        // Find nearest milestone by due_date
        let bestMs = msWithDates[0];
        let bestDist = Math.abs(parseDate(item.due_date).getTime() - parseDate(bestMs.due_date!).getTime());
        for (let i = 1; i < msWithDates.length; i++) {
          const dist = Math.abs(parseDate(item.due_date).getTime() - parseDate(msWithDates[i].due_date!).getTime());
          if (dist < bestDist) { bestDist = dist; bestMs = msWithDates[i]; }
        }
        if (!msItems[bestMs.id]) msItems[bestMs.id] = [];
        msItems[bestMs.id].push(item);
      }
      return { msItems, orphanItems };
    }

    // Build per-phase data
    const phases = phasesArr.map((phase) => {
      const milestones = msByPhase[phase.id] || [];
      const phaseItems = itemsByPhase[phase.id] || [];
      const { msItems, orphanItems } = assignItemsToMilestones(milestones, phaseItems);
      return { phase, milestones, msItems, orphanItems };
    });

    // Unmatched section
    const { msItems: unmatchedMsItems, orphanItems: globalOrphanItems } = assignItemsToMilestones(unmatchedMs, unmatchedItems);

    return { phases, unmatchedMs, unmatchedMsItems, globalOrphanItems };
  }, [confirmedItems, patchedProject.phases, patchedProject.milestones]);

  const { rangeStart, totalDays, months } = useMemo(() => {
    const allDates: Date[] = [];
    for (const ph of patchedProject.phases) {
      if (ph.start_date) allDates.push(parseDate(ph.start_date));
      if (ph.end_date) allDates.push(parseDate(ph.end_date));
      if (ph.actual_end_date) allDates.push(parseDate(ph.actual_end_date));
    }
    for (const ms of patchedProject.milestones) {
      if (ms.due_date) allDates.push(parseDate(ms.due_date));
    }
    if (allDates.length === 0) {
      return { rangeStart: today, totalDays: 30, months: [] };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    minDate.setDate(1);
    maxDate.setMonth(maxDate.getMonth() + 1, 0);

    const total = diffDays(minDate, maxDate) + 1;

    const monthLabels: { label: string; leftPct: number; widthPct: number }[] = [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const effectiveEnd = monthEnd > maxDate ? maxDate : monthEnd;
      const left = diffDays(minDate, monthStart);
      const width = diffDays(monthStart, effectiveEnd) + 1;
      monthLabels.push({
        label: formatMonth(monthStart),
        leftPct: (left / total) * 100,
        widthPct: (width / total) * 100,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }

    return { rangeStart: minDate, totalDays: total, months: monthLabels };
  }, [patchedProject, today]);

  function toPct(dateStr: string): number {
    const d = diffDays(rangeStart, parseDate(dateStr));
    return (d / totalDays) * 100;
  }

  function widthPct(startStr: string, endStr: string): number {
    const d = diffDays(parseDate(startStr), parseDate(endStr)) + 1;
    return Math.max(0, (d / totalDays) * 100);
  }

  const todayPct = (() => {
    const d = diffDays(rangeStart, today);
    if (d < 0 || d > totalDays) return null;
    return (d / totalDays) * 100;
  })();

  const sortedPhases = [...patchedProject.phases].sort((a, b) => a.sort_order - b.sort_order);

  // --- Pending change handlers (accumulate locally, save on explicit action) ---
  const handlePhaseUpdate = (phaseId: string, patch: Record<string, unknown>) => {
    setPendingPhases((prev) => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] || {}), ...patch },
    }));
  };

  const handleMsUpdate = (msId: string, patch: Record<string, unknown>) => {
    setPendingMilestones((prev) => ({
      ...prev,
      [msId]: { ...(prev[msId] || {}), ...patch },
    }));
  };

  // Flush all pending changes to API
  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];
      for (const [phaseId, patch] of Object.entries(pendingPhases)) {
        promises.push(updatePhase(projectId, phaseId, patch));
      }
      for (const [msId, patch] of Object.entries(pendingMilestones)) {
        promises.push(updateMilestone(projectId, msId, patch));
      }
      await Promise.all(promises);
      setPendingPhases({});
      setPendingMilestones({});
      onRefresh();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [pendingPhases, pendingMilestones, projectId, onRefresh]);

  const handleDiscardChanges = () => {
    setPendingPhases({});
    setPendingMilestones({});
  };

  // --- Immediate actions (create/delete still apply immediately) ---
  const handlePhaseDelete = async (phaseId: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try { await deletePhase(projectId, phaseId); onRefresh(); }
    catch { alert("フェーズの削除に失敗しました"); }
  };

  const handleAddPhase = async () => {
    if (!newPhase.name) return;
    try {
      await createPhase(projectId, {
        name: newPhase.name,
        sort_order: sortedPhases.length,
        start_date: newPhase.start_date || undefined,
        end_date: newPhase.end_date || undefined,
      });
      setNewPhase({ name: "", start_date: "", end_date: "" });
      setAddingPhase(false);
      onRefresh();
    } catch { alert("フェーズの追加に失敗しました"); }
  };

  const handleMsDelete = async (msId: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try { await deleteMilestone(projectId, msId); onRefresh(); }
    catch { alert("マイルストーンの削除に失敗しました"); }
  };

  const handleAddMs = async (phaseId: string | null) => {
    if (!newMs.name) return;
    try {
      await createMilestone(projectId, {
        name: newMs.name,
        due_date: newMs.due_date || undefined,
        phase_id: phaseId ?? undefined,
      });
      setNewMs({ name: "", due_date: "" });
      setAddingMsPhaseId(null);
      onRefresh();
    } catch { alert("マイルストーンの追加に失敗しました"); }
  };

  // Apply pending changes to display data optimistically
  const patchedProject = useMemo(() => {
    const phases = project.phases.map((ph) => {
      const patch = pendingPhases[ph.id];
      return patch ? { ...ph, ...patch } as typeof ph : ph;
    });
    const milestones = project.milestones.map((ms) => {
      const patch = pendingMilestones[ms.id];
      return patch ? { ...ms, ...patch } as typeof ms : ms;
    });
    return { ...project, phases, milestones };
  }, [project, pendingPhases, pendingMilestones]);

  // Render items list (decisions first, then TODOs)
  const renderItems = (itemList: ExtractedItemRow[]) => {
    const decisions = itemList.filter((i) => i.type === "decision");
    const todos = itemList.filter((i) => i.type === "todo");
    const ordered = [...decisions, ...todos];
    if (ordered.length === 0) return null;

    return (
      <div className="space-y-0.5">
        {ordered.map((item) => {
          const badge = typeBadge[item.type];
          return (
            <div key={item.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 text-sm">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.label}</span>
              <span className="flex-1 text-gray-700 truncate">{item.content}</span>
              <span className="text-xs text-gray-400 shrink-0">{resolveName(item.assignee_member_id)}</span>
              {item.due_date && <span className="text-xs text-gray-400 shrink-0">{item.due_date}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render milestone row with nested items (decisions → TODOs)
  const renderMilestone = (ms: typeof project.milestones[0], msItems: ExtractedItemRow[] = []) => {
    const isExpanded = expandedMilestones.has(ms.id);
    const color = ms.status === "achieved" ? "text-green-500" : "text-yellow-500";
    return (
      <div key={ms.id} className="border-l-2 border-gray-200 ml-3">
        <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-gray-50 group">
          <span className={`${color} text-sm leading-none select-none`}>&#9670;</span>
          <button
            className="flex-1 text-left text-sm text-gray-700 font-medium truncate"
            onClick={() => toggleMilestone(ms.id)}
          >
            {ms.name}
          </button>
          {ms.due_date && <span className="text-xs text-gray-400 shrink-0">{ms.due_date}</span>}
          <span className={`text-xs shrink-0 ${ms.status === "achieved" ? "text-green-500" : "text-yellow-500"}`}>
            {ms.status === "achieved" ? "達成" : "未達"}
          </span>
          <span className="text-xs text-gray-300 shrink-0">{ms.source === "ai" ? "AI" : "手動"}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              className="text-xs text-red-400 hover:text-red-600"
              onClick={() => handleMsDelete(ms.id, ms.name)}
            >削除</button>
          </div>
        </div>
        {isExpanded && (
          <div className="ml-6 mb-1">
            {/* Inline edit for milestone */}
            <div className="flex gap-2 mb-2 items-center text-sm flex-wrap">
              <label className="text-xs text-gray-400 w-12">名前:</label>
              <input
                type="text"
                className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none flex-1"
                value={ms.name}
                onChange={(e) => handleMsUpdate(ms.id, { name: e.target.value })}
              />
              <label className="text-xs text-gray-400 w-12">期日:</label>
              <input
                type="date"
                className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                value={ms.due_date ?? ""}
                onChange={(e) => handleMsUpdate(ms.id, { due_date: e.target.value || null })}
              />
              <label className="text-xs text-gray-400 w-16">ステータス:</label>
              <select
                className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-1 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                value={ms.status}
                onChange={(e) => handleMsUpdate(ms.id, { status: e.target.value })}
              >
                <option value="pending">未達</option>
                <option value="achieved">達成</option>
              </select>
              <label className="text-xs text-gray-400 w-16">フェーズ:</label>
              <select
                className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-1 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                value={ms.phase_id ?? ""}
                onChange={(e) => handleMsUpdate(ms.id, { phase_id: e.target.value || null })}
              >
                <option value="">未分類</option>
                {sortedPhases.map((ph) => (
                  <option key={ph.id} value={ph.id}>{ph.name}</option>
                ))}
              </select>
            </div>
            {/* Nested items under this milestone: decisions → TODOs */}
            {msItems.length > 0 && (
              <div className="ml-2 mt-1 border-l-2 border-gray-100 pl-2">
                {renderItems(msItems)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* ===== Save bar ===== */}
      {hasPendingChanges && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm">
          <span className="text-sm text-yellow-800 flex-1">未保存の変更があります</span>
          <button
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-corp text-white rounded hover:bg-corp-dark disabled:opacity-50"
            onClick={handleSaveAll}
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={handleDiscardChanges}
          >
            破棄
          </button>
        </div>
      )}

      {/* ===== Gantt Chart ===== */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500">ズーム:</span>
        <button
          className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
          disabled={zoomLevel <= 0.5}
          onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
        >−</button>
        <span className="text-xs text-gray-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
        <button
          className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
          disabled={zoomLevel >= 3}
          onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
        >+</button>
        <button
          className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
          onClick={() => setZoomLevel(1)}
        >リセット</button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${700 * zoomLevel}px` }}>
          {/* Month header */}
          <div className="flex h-8 border-b border-gray-300">
            <div className="shrink-0" style={{ width: `${LABEL_WIDTH}px` }} />
            <div className="flex-1 relative">
              {months.map((m) => (
                <div key={m.label}
                  className="absolute text-xs text-gray-600 border-l border-gray-200 pl-1 h-full flex items-center"
                  style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                >{m.label}</div>
              ))}
            </div>
          </div>

          {/* Phase bars */}
          {sortedPhases.map((phase) => {
            const hasRange = phase.start_date && phase.end_date;
            const plannedLeft = hasRange ? toPct(phase.start_date) : 0;
            const plannedW = hasRange ? widthPct(phase.start_date, phase.end_date) : 0;

            let actualLeft: number | null = null;
            let actualW: number | null = null;
            let barColor = "bg-corp";

            if (hasRange && phase.status === "completed" && phase.actual_end_date) {
              actualLeft = toPct(phase.start_date);
              actualW = widthPct(phase.start_date, phase.actual_end_date);
              barColor = parseDate(phase.actual_end_date) > parseDate(phase.end_date) ? "bg-red-400" : "bg-green-400";
            } else if (hasRange && phase.status === "in_progress") {
              actualLeft = toPct(phase.start_date);
              const endStr = today < parseDate(phase.end_date) ? today.toISOString().slice(0, 10) : phase.end_date;
              if (parseDate(endStr) >= parseDate(phase.start_date)) actualW = widthPct(phase.start_date, endStr);
              barColor = "bg-corp";
            }

            return (
              <div key={phase.id} className="flex items-center h-10 border-b border-gray-100">
                <div className="shrink-0 text-sm pr-2 text-right truncate" style={{ width: `${LABEL_WIDTH}px` }}>
                  {phase.name}
                </div>
                <div className="flex-1 relative h-full">
                  {hasRange && <div className="absolute top-3 h-4 bg-gray-200 rounded-sm" style={{ left: `${plannedLeft}%`, width: `${plannedW}%` }} />}
                  {actualLeft !== null && actualW !== null && actualW > 0 && (
                    <div className={`absolute top-3 h-4 rounded-sm opacity-80 ${barColor}`} style={{ left: `${actualLeft}%`, width: `${actualW}%` }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Milestone markers */}
          {patchedProject.milestones.map((ms) => {
            if (!ms.due_date) return null;
            const leftPct = toPct(ms.due_date);
            const color = ms.status === "achieved" ? "text-green-500" : "text-yellow-500";
            return (
              <div key={ms.id} className="flex items-center h-8 border-b border-gray-50">
                <div className="shrink-0 text-xs pr-2 text-right truncate text-gray-500" style={{ width: `${LABEL_WIDTH}px` }}>{ms.name}</div>
                <div className="flex-1 relative h-full">
                  <div className={`absolute top-1 ${color}`} style={{ left: `${leftPct}%` }} title={`${ms.name} (${ms.due_date})`}>
                    <span className="text-sm leading-none select-none">&#9670;</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Today line */}
          {todayPct !== null && (
            <div className="flex pointer-events-none" style={{ position: "relative", marginTop: `-${(sortedPhases.length * 40) + (patchedProject.milestones.length * 32) + 32}px`, height: `${(sortedPhases.length * 40) + (patchedProject.milestones.length * 32) + 32}px` }}>
              <div className="shrink-0" style={{ width: `${LABEL_WIDTH}px` }} />
              <div className="flex-1 relative">
                <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400" style={{ left: `${todayPct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-gray-200 rounded-sm" />予定</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-400 rounded-sm" />完了</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-corp rounded-sm" />進行中</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-400 rounded-sm" />遅延</span>
        <span className="flex items-center gap-1"><span className="text-yellow-500">&#9670;</span>未達</span>
        <span className="flex items-center gap-1"><span className="text-green-500">&#9670;</span>達成</span>
        <span className="flex items-center gap-1"><span className="border-l-2 border-dashed border-red-400 h-3 inline-block" />今日</span>
      </div>

      {/* ===== Nested Tree: Phase > Milestone > 決定事項 > TODO ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500">スケジュール管理</h3>
          {!addingPhase && (
            <button className="text-xs text-corp hover:text-corp-dark" onClick={() => setAddingPhase(true)}>+ フェーズ追加</button>
          )}
        </div>

        <div className="space-y-1">
          {nestedData.phases.map(({ phase, milestones, msItems, orphanItems }) => {
            const isExpanded = expandedPhases.has(phase.id);
            const totalItems = milestones.length + Object.values(msItems).reduce((s, arr) => s + arr.length, 0) + orphanItems.length;

            return (
              <div key={phase.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Phase header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 group">
                  <button
                    className="text-gray-400 hover:text-gray-600 text-xs w-4"
                    onClick={() => togglePhase(phase.id)}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[phase.status]}`} />
                  <span className="font-medium text-sm text-gray-800 flex-1">{phase.name}</span>
                  {phase.start_date && phase.end_date && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {phase.start_date} ~ {phase.end_date}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 shrink-0">{STATUS_LABELS[phase.status]}</span>
                  {totalItems > 0 && (
                    <span className="text-xs text-gray-300 shrink-0">({totalItems})</span>
                  )}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      className="text-xs text-corp hover:text-corp-dark"
                      onClick={(e) => { e.stopPropagation(); setAddingMsPhaseId(phase.id); }}
                    >+MS</button>
                    <button
                      className="text-xs text-red-400 hover:text-red-600"
                      onClick={() => handlePhaseDelete(phase.id, phase.name)}
                    >削除</button>
                  </div>
                </div>

                {/* Expanded: Phase edit + Milestones (with nested items) */}
                {isExpanded && (
                  <div className="px-2 py-2 space-y-1">
                    {/* Phase inline edit */}
                    <div className="flex gap-2 items-center text-sm px-3 pb-2 border-b border-gray-100 mb-2 flex-wrap">
                      <label className="text-xs text-gray-400">名前:</label>
                      <input
                        type="text"
                        className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none flex-1"
                        value={phase.name}
                        onChange={(e) => handlePhaseUpdate(phase.id, { name: e.target.value })}
                      />
                      <label className="text-xs text-gray-400">開始:</label>
                      <input
                        type="date"
                        className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                        value={phase.start_date ?? ""}
                        onChange={(e) => handlePhaseUpdate(phase.id, { start_date: e.target.value || null })}
                      />
                      <label className="text-xs text-gray-400">終了:</label>
                      <input
                        type="date"
                        className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                        value={phase.end_date ?? ""}
                        onChange={(e) => handlePhaseUpdate(phase.id, { end_date: e.target.value || null })}
                      />
                      <label className="text-xs text-gray-400">実績終了:</label>
                      <input
                        type="date"
                        className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-2 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                        value={phase.actual_end_date ?? ""}
                        onChange={(e) => handlePhaseUpdate(phase.id, { actual_end_date: e.target.value || null })}
                      />
                      <select
                        className="border border-transparent hover:border-gray-300 focus:border-corp rounded px-1 py-0.5 text-sm bg-transparent focus:bg-white transition-colors outline-none"
                        value={phase.status}
                        onChange={(e) => handlePhaseUpdate(phase.id, { status: e.target.value })}
                      >
                        <option value="not_started">{STATUS_LABELS.not_started}</option>
                        <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                        <option value="completed">{STATUS_LABELS.completed}</option>
                      </select>
                    </div>

                    {/* Milestones with nested decision/TODO items */}
                    {milestones.map((ms) => renderMilestone(ms, msItems[ms.id] || []))}

                    {/* Add milestone row */}
                    {addingMsPhaseId === phase.id && (
                      <div className="flex gap-2 items-center ml-3 px-3 py-1.5 bg-corp-light rounded">
                        <span className="text-yellow-500 text-sm">&#9670;</span>
                        <input
                          type="text"
                          className="border border-gray-300 rounded px-2 py-0.5 text-sm flex-1"
                          placeholder="マイルストーン名"
                          value={newMs.name}
                          onChange={(e) => setNewMs({ ...newMs, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddMs(phase.id); if (e.key === "Escape") setAddingMsPhaseId(null); }}
                          autoFocus
                        />
                        <input
                          type="date"
                          className="border border-gray-300 rounded px-2 py-0.5 text-sm"
                          value={newMs.due_date}
                          onChange={(e) => setNewMs({ ...newMs, due_date: e.target.value })}
                        />
                        <button className="text-xs text-corp hover:text-corp-dark font-medium" onClick={() => handleAddMs(phase.id)}>追加</button>
                        <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setAddingMsPhaseId(null); setNewMs({ name: "", due_date: "" }); }}>取消</button>
                      </div>
                    )}

                    {/* Orphan items (no milestone match within this phase) */}
                    {orphanItems.length > 0 && (
                      <div className="ml-3 mt-1">
                        <div className="text-xs text-gray-400 px-2 py-1">未割当アイテム</div>
                        {renderItems(orphanItems)}
                      </div>
                    )}

                    {milestones.length === 0 && orphanItems.length === 0 && addingMsPhaseId !== phase.id && (
                      <p className="text-xs text-gray-400 px-3 py-2">マイルストーンやアイテムがありません</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add phase row */}
          {addingPhase && (
            <div className="border border-corp/30 rounded-lg p-3 bg-corp-light">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                  placeholder="フェーズ名"
                  value={newPhase.name}
                  onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPhase(); if (e.key === "Escape") setAddingPhase(false); }}
                  autoFocus
                />
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  value={newPhase.start_date}
                  onChange={(e) => setNewPhase({ ...newPhase, start_date: e.target.value })}
                />
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  value={newPhase.end_date}
                  onChange={(e) => setNewPhase({ ...newPhase, end_date: e.target.value })}
                />
                <button className="text-xs text-corp hover:text-corp-dark font-medium" onClick={handleAddPhase}>追加</button>
                <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setAddingPhase(false); setNewPhase({ name: "", start_date: "", end_date: "" }); }}>取消</button>
              </div>
            </div>
          )}

          {/* Unmatched (no phase) */}
          {(nestedData.unmatchedMs.length > 0 || nestedData.globalOrphanItems.length > 0) && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                <span className="text-xs text-gray-400">&#9632;</span>
                <span className="font-medium text-sm text-gray-500 flex-1">未分類</span>
                <button
                  className="text-xs text-corp hover:text-corp-dark"
                  onClick={() => setAddingMsPhaseId("__none__")}
                >+MS</button>
              </div>
              <div className="px-2 py-2 space-y-1">
                {nestedData.unmatchedMs.map((ms) => renderMilestone(ms, nestedData.unmatchedMsItems[ms.id] || []))}
                {addingMsPhaseId === "__none__" && (
                  <div className="flex gap-2 items-center ml-3 px-3 py-1.5 bg-corp-light rounded">
                    <span className="text-yellow-500 text-sm">&#9670;</span>
                    <input
                      type="text"
                      className="border border-gray-300 rounded px-2 py-0.5 text-sm flex-1"
                      placeholder="マイルストーン名"
                      value={newMs.name}
                      onChange={(e) => setNewMs({ ...newMs, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddMs(null); if (e.key === "Escape") setAddingMsPhaseId(null); }}
                      autoFocus
                    />
                    <input
                      type="date"
                      className="border border-gray-300 rounded px-2 py-0.5 text-sm"
                      value={newMs.due_date}
                      onChange={(e) => setNewMs({ ...newMs, due_date: e.target.value })}
                    />
                    <button className="text-xs text-corp hover:text-corp-dark font-medium" onClick={() => handleAddMs(null)}>追加</button>
                    <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setAddingMsPhaseId(null); setNewMs({ name: "", due_date: "" }); }}>取消</button>
                  </div>
                )}
                {nestedData.globalOrphanItems.length > 0 && (
                  <div className="ml-3 mt-1">
                    <div className="text-xs text-gray-400 px-2 py-1">未割当アイテム</div>
                    {renderItems(nestedData.globalOrphanItems)}
                  </div>
                )}
              </div>
            </div>
          )}

          {sortedPhases.length === 0 && !addingPhase && (
            <p className="text-sm text-gray-400 py-4 text-center">フェーズがありません。「+ フェーズ追加」から始めましょう。</p>
          )}
        </div>
      </section>
    </div>
  );
}
