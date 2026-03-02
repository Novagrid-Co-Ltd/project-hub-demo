import { useState } from "react";
import type { ProjectMeetingRow } from "../lib/api";

interface Props {
  meetings: ProjectMeetingRow[];
}

export default function MeetingHistory({ meetings }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (meetings.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        このプロジェクトに関連する会議はありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((pm) => {
        const meeting = pm.row_meeting_raw;
        if (!meeting) return null;

        const startDate = meeting.event_start
          ? new Date(meeting.event_start).toLocaleDateString("ja-JP")
          : "-";

        return (
          <div
            key={pm.id}
            className="border border-gray-200 rounded overflow-hidden"
          >
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              onClick={() => toggle(pm.id)}
            >
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {meeting.event_summary ?? "(無題)"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {startDate}
                  {meeting.attendee_count > 0 &&
                    ` / ${meeting.attendee_count}名参加`}
                  <span className="ml-2 text-gray-400">
                    ({pm.matched_by === "ai" ? "自動紐付け" : "手動紐付け"})
                  </span>
                </div>
              </div>
              <span className="text-gray-400 text-sm">
                {expandedId === pm.id ? "\u25B2" : "\u25BC"}
              </span>
            </button>
            {expandedId === pm.id && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-500 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {meeting.transcript
                  ? meeting.transcript.slice(0, 2000) +
                    (meeting.transcript.length > 2000 ? "\n\n... (truncated)" : "")
                  : "議事録は利用できません"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
