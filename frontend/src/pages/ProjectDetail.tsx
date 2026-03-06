import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getProject,
  getExtractedItems,
  getMembers,
  type ProjectDetail as ProjectDetailData,
  type ExtractedItemRow,
  type MemberRow,
} from "../lib/api";
import type { Project, Member, Phase, Milestone } from "../mock/data";
import GanttChart from "../components/GanttChart";
import ProjectOverview from "../components/ProjectOverview";
import ExtractedItemList from "../components/ExtractedItemList";
import MeetingHistory from "../components/MeetingHistory";

const TABS = [
  { key: "gantt", label: "ガントチャート" },
  { key: "overview", label: "概要" },
  { key: "items", label: "TODO・決定事項" },
  { key: "history", label: "会議履歴" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Convert API project data to the shape GanttChart / ProjectOverview expect */
function toProject(d: ProjectDetailData): Project {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    status: d.status,
    calendar_keywords: d.calendar_keywords,
    start_date: d.start_date ?? "",
    end_date: d.end_date ?? "",
    members: d.members.map((m) => ({
      member_id: m.member_id,
      role: m.role,
    })),
    phases: d.phases.map(
      (p): Phase => ({
        id: p.id,
        name: p.name,
        sort_order: p.sort_order,
        start_date: p.start_date ?? "",
        end_date: p.end_date ?? "",
        actual_end_date: p.actual_end_date,
        status: p.status,
      })
    ),
    milestones: d.milestones.map(
      (ms): Milestone => ({
        id: ms.id,
        name: ms.name,
        due_date: ms.due_date ?? "",
        status: ms.status,
        phase_id: ms.phase_id,
        source: ms.source,
      })
    ),
  };
}

function toMembers(
  apiMembers: MemberRow[],
  projectMembers: ProjectDetailData["members"]
): Member[] {
  // Build from project members (with resolved names) + all members
  const memberMap = new Map<string, Member>();
  for (const am of apiMembers) {
    memberMap.set(am.id, { id: am.id, name: am.display_name, email: am.email });
  }
  for (const pm of projectMembers) {
    const mpi = Array.isArray(pm.master_person_identity)
      ? pm.master_person_identity[0]
      : pm.master_person_identity;
    if (mpi && !memberMap.has(mpi.id)) {
      memberMap.set(mpi.id, { id: mpi.id, name: mpi.display_name, email: mpi.email });
    }
  }
  return Array.from(memberMap.values());
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("gantt");
  const [projectData, setProjectData] = useState<ProjectDetailData | null>(null);
  const [items, setItems] = useState<ExtractedItemRow[]>([]);
  const [allMembers, setAllMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [pd, ei, mem] = await Promise.all([
        getProject(id),
        getExtractedItems({ project_id: id }),
        getMembers(),
      ]);
      setProjectData(pd);
      setItems(ei);
      setAllMembers(mem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">読み込み中...</p>
    );
  }

  if (error || !projectData) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-600 mb-2">
          {error ?? "プロジェクトが見つかりません"}
        </p>
        <button
          className="text-sm text-corp hover:underline"
          onClick={fetchData}
        >
          再読み込み
        </button>
      </div>
    );
  }

  const project = toProject(projectData);
  const members = toMembers(allMembers, projectData.members);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4">{project.name}</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm -mb-px ${
              activeTab === tab.key
                ? "border-b-2 border-corp text-corp font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "gantt" && <GanttChart project={project} projectId={projectData.id} items={items} members={members} onRefresh={fetchData} />}
      {activeTab === "overview" && (
        <ProjectOverview
          project={project}
          members={members}
          projectId={projectData.id}
          onSaved={fetchData}
        />
      )}
      {activeTab === "items" && (
        <ExtractedItemList
          items={items}
          members={members}
          projectId={projectData.id}
          onRefresh={fetchData}
        />
      )}
      {activeTab === "history" && (
        <MeetingHistory meetings={projectData.meetings} />
      )}
    </div>
  );
}
