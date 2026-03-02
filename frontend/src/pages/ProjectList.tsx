import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getProjects,
  triggerMatchMeetings,
  triggerBatchExtraction,
  type ProjectListItem,
} from "../lib/api";

function statusBadge(status: ProjectListItem["status"]) {
  const colors: Record<ProjectListItem["status"], string> = {
    active: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
    archived: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status]}`}
    >
      {status}
    </span>
  );
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleMatchMeetings = async () => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await triggerMatchMeetings();
      setActionMsg(
        `マッチング完了: ${res.summary.totalProcessed}件処理、${res.summary.matched}件紐付け`
      );
      fetchProjects();
    } catch (err) {
      setActionMsg(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchExtract = async () => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await triggerBatchExtraction();
      setActionMsg(
        `抽出完了: ${res.summary.total}件処理（成功: ${res.summary.succeeded}, スキップ: ${res.summary.skipped}, 失敗: ${res.summary.failed}）`
      );
      fetchProjects();
    } catch (err) {
      setActionMsg(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">読み込み中...</p>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={fetchProjects}
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-2">
          <button
            disabled={actionLoading}
            onClick={handleMatchMeetings}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            未紐付け会議をマッチング
          </button>
          <button
            disabled={actionLoading}
            onClick={handleBatchExtract}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            未抽出会議を一括抽出
          </button>
          <Link
            to="/projects/new"
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium no-underline hover:bg-blue-700"
          >
            ＋ 新規PJ作成
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded border border-blue-200">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-gray-900">{project.name}</span>
              {statusBadge(project.status)}
              {project.draft_item_count > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  未確認 {project.draft_item_count}
                </span>
              )}
            </div>

            <div className="text-sm text-gray-500 mb-1">
              フェーズ: {project.current_phase ?? "-"}
            </div>

            <p className="text-sm text-gray-600 line-clamp-2">
              {project.description}
            </p>
          </div>
        ))}

        {projects.length === 0 && (
          <p className="text-sm text-gray-400 col-span-2 text-center py-8">
            プロジェクトがありません。「＋ 新規PJ作成」から始めましょう。
          </p>
        )}
      </div>
    </div>
  );
}
