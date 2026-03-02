import { useMemo } from "react";
import type { Project } from "../mock/data";

interface Props {
  project: Project;
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

export default function GanttChart({ project }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { rangeStart, totalDays, months } = useMemo(() => {
    const allDates: Date[] = [];
    for (const ph of project.phases) {
      allDates.push(parseDate(ph.start_date));
      allDates.push(parseDate(ph.end_date));
      if (ph.actual_end_date) allDates.push(parseDate(ph.actual_end_date));
    }
    for (const ms of project.milestones) {
      allDates.push(parseDate(ms.due_date));
    }
    if (allDates.length === 0) {
      return { rangeStart: today, totalDays: 30, months: [] };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    // Pad to start/end of months
    minDate.setDate(1);
    maxDate.setMonth(maxDate.getMonth() + 1, 0);

    const total = diffDays(minDate, maxDate) + 1;

    const monthLabels: { label: string; leftPct: number; widthPct: number }[] =
      [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0
      );
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
  }, [project, today]);

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

  const sortedPhases = [...project.phases].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Month header row */}
        <div className="flex h-8 border-b border-gray-300">
          <div
            className="shrink-0"
            style={{ width: `${LABEL_WIDTH}px` }}
          />
          <div className="flex-1 relative">
            {months.map((m) => (
              <div
                key={m.label}
                className="absolute text-xs text-gray-600 border-l border-gray-200 pl-1 h-full flex items-center"
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Phase rows */}
        {sortedPhases.map((phase) => {
          const plannedLeft = toPct(phase.start_date);
          const plannedW = widthPct(phase.start_date, phase.end_date);

          let actualLeft: number | null = null;
          let actualW: number | null = null;
          let barColor = "bg-blue-400";

          if (phase.status === "completed" && phase.actual_end_date) {
            actualLeft = toPct(phase.start_date);
            actualW = widthPct(phase.start_date, phase.actual_end_date);
            const delayed =
              parseDate(phase.actual_end_date) > parseDate(phase.end_date);
            barColor = delayed ? "bg-red-400" : "bg-green-400";
          } else if (phase.status === "in_progress") {
            actualLeft = toPct(phase.start_date);
            const endStr =
              today < parseDate(phase.end_date)
                ? today.toISOString().slice(0, 10)
                : phase.end_date;
            if (parseDate(endStr) >= parseDate(phase.start_date)) {
              actualW = widthPct(phase.start_date, endStr);
            }
            barColor = "bg-blue-400";
          }

          return (
            <div
              key={phase.id}
              className="flex items-center h-10 border-b border-gray-100"
            >
              <div
                className="shrink-0 text-sm pr-2 text-right truncate"
                style={{ width: `${LABEL_WIDTH}px` }}
              >
                {phase.name}
              </div>
              <div className="flex-1 relative h-full">
                {/* Planned */}
                <div
                  className="absolute top-3 h-4 bg-gray-200 rounded-sm"
                  style={{ left: `${plannedLeft}%`, width: `${plannedW}%` }}
                />
                {/* Actual */}
                {actualLeft !== null && actualW !== null && actualW > 0 && (
                  <div
                    className={`absolute top-3 h-4 rounded-sm opacity-80 ${barColor}`}
                    style={{
                      left: `${actualLeft}%`,
                      width: `${actualW}%`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Milestone rows */}
        {project.milestones.map((ms) => {
          const leftPct = toPct(ms.due_date);
          const color =
            ms.status === "achieved" ? "text-green-500" : "text-yellow-500";
          return (
            <div
              key={ms.id}
              className="flex items-center h-8 border-b border-gray-50"
            >
              <div
                className="shrink-0 text-xs pr-2 text-right truncate text-gray-500"
                style={{ width: `${LABEL_WIDTH}px` }}
              >
                {ms.name}
              </div>
              <div className="flex-1 relative h-full">
                <div
                  className={`absolute top-1 ${color}`}
                  style={{ left: `${leftPct}%` }}
                  title={`${ms.name} (${ms.due_date})`}
                >
                  <span className="text-sm leading-none select-none">
                    &#9670;
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Today line overlay -- we layer it on the entire chart area using a second pass */}
        {todayPct !== null && (
          <div className="flex pointer-events-none" style={{ position: "relative", marginTop: `-${(sortedPhases.length * 40) + (project.milestones.length * 32) + 32}px`, height: `${(sortedPhases.length * 40) + (project.milestones.length * 32) + 32}px` }}>
            <div className="shrink-0" style={{ width: `${LABEL_WIDTH}px` }} />
            <div className="flex-1 relative">
              <div
                className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400"
                style={{ left: `${todayPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-gray-200 rounded-sm" />
          予定
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-400 rounded-sm" />
          完了
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-400 rounded-sm" />
          進行中
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-400 rounded-sm" />
          遅延
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-500">&#9670;</span>
          未達
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-500">&#9670;</span>
          達成
        </span>
        <span className="flex items-center gap-1">
          <span className="border-l-2 border-dashed border-red-400 h-3 inline-block" />
          今日
        </span>
      </div>
    </div>
  );
}
