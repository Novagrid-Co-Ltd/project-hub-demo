const API_KEY = "Mancity.94";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `API error: ${res.status}`);
  }
  const json = await res.json();
  if (json.ok === false) throw new Error(json.error?.message ?? "Unknown error");
  return json;
}

// --- Projects ---

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  status: "active" | "on_hold" | "completed" | "archived";
  calendar_keywords: string[];
  start_date: string | null;
  end_date: string | null;
  draft_item_count: number;
  current_phase: string | null;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: "active" | "on_hold" | "completed" | "archived";
  calendar_keywords: string[];
  start_date: string | null;
  end_date: string | null;
  members: ProjectMemberRow[];
  phases: PhaseRow[];
  milestones: MilestoneRow[];
  meetings: ProjectMeetingRow[];
}

export interface ProjectMemberRow {
  id: string;
  member_id: string;
  role: string;
  mst_person_identity: { id: string; display_name: string; email: string } | { id: string; display_name: string; email: string }[] | null;
}

export interface PhaseRow {
  id: string;
  name: string;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  status: "not_started" | "in_progress" | "completed";
}

export interface MilestoneRow {
  id: string;
  name: string;
  due_date: string | null;
  status: "pending" | "achieved";
  phase_id: string | null;
  source: "manual" | "ai";
}

export interface ProjectMeetingRow {
  id: string;
  project_id: string;
  meeting_id: string;
  matched_by: "manual" | "ai";
  row_meeting_raw: {
    id: string;
    event_summary: string;
    event_start: string;
    event_end: string;
    attendee_count: number;
    transcript?: string;
  } | null;
}

export async function getProjects(): Promise<ProjectListItem[]> {
  const res = await request<{ data: ProjectListItem[] }>("/api/projects");
  return res.data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await request<{ data: ProjectDetail }>(`/api/projects/${id}`);
  return res.data;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  calendar_keywords?: string[];
  start_date?: string | null;
  end_date?: string | null;
  members?: { member_id: string; role: string }[];
  phases?: { name: string; sort_order: number; start_date?: string | null; end_date?: string | null }[];
}

export async function createProject(data: CreateProjectPayload) {
  return request<{ data: unknown }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Record<string, unknown>) {
  return request<{ data: unknown }>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// --- Members ---

export interface MemberRow {
  id: string;
  display_name: string;
  email: string;
  department: string | null;
  role: string | null;
}

export async function getMembers(): Promise<MemberRow[]> {
  const res = await request<{ data: MemberRow[] }>("/api/members");
  return res.data;
}

// --- Project Members ---

export async function addProjectMember(projectId: string, memberId: string, role: string) {
  return request<{ data: unknown }>(`/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, role }),
  });
}

export async function updateProjectMemberRole(projectId: string, memberId: string, role: string) {
  return request<{ data: unknown }>(`/api/projects/${projectId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeProjectMember(projectId: string, memberId: string) {
  return request<{ data: unknown }>(`/api/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// --- Extracted Items ---

export interface ExtractedItemRow {
  id: string;
  meeting_id: string;
  project_id: string | null;
  milestone_id: string | null;
  type: "todo" | "decision" | "issue" | "phase_change";
  status: "draft" | "confirmed" | "rejected";
  content: string;
  assignee_member_id: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  ai_original: {
    content: string;
    assignee?: string | null;
    due_date?: string | null;
    priority?: string;
    source_quote?: string;
    phase_completed?: string;
    phase_started?: string;
  };
}

export async function getExtractedItems(params?: { project_id?: string; status?: string; type?: string }): Promise<ExtractedItemRow[]> {
  const sp = new URLSearchParams();
  if (params?.project_id) sp.set("project_id", params.project_id);
  if (params?.status) sp.set("status", params.status);
  if (params?.type) sp.set("type", params.type);
  const qs = sp.toString();
  const res = await request<{ data: ExtractedItemRow[] }>(`/api/extracted-items${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function updateItem(id: string, data: { content?: string; assignee_member_id?: string | null; due_date?: string | null; priority?: string; milestone_id?: string | null }) {
  return request<{ data: ExtractedItemRow }>(`/api/extracted-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function confirmItem(id: string) {
  return request<{ data: ExtractedItemRow }>(`/api/extracted-items/${id}/confirm`, { method: "PATCH" });
}

export async function rejectItem(id: string) {
  return request<{ data: ExtractedItemRow }>(`/api/extracted-items/${id}/reject`, { method: "PATCH" });
}

// --- Phases ---

export async function createPhase(projectId: string, data: { name: string; sort_order?: number; start_date?: string; end_date?: string; status?: string }) {
  return request<{ data: PhaseRow }>(`/api/projects/${projectId}/phases`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePhase(projectId: string, phaseId: string, data: Record<string, unknown>) {
  return request<{ data: PhaseRow }>(`/api/projects/${projectId}/phases/${phaseId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePhase(projectId: string, phaseId: string) {
  return request<{ ok: boolean }>(`/api/projects/${projectId}/phases/${phaseId}`, {
    method: "DELETE",
  });
}

// --- Milestones ---

export async function createMilestone(projectId: string, data: { name: string; due_date?: string; phase_id?: string }) {
  return request<{ data: MilestoneRow }>(`/api/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify({ ...data, source: "manual" }),
  });
}

export async function updateMilestone(projectId: string, milestoneId: string, data: Record<string, unknown>) {
  return request<{ data: MilestoneRow }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMilestone(projectId: string, milestoneId: string) {
  return request<{ ok: boolean }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
    method: "DELETE",
  });
}

// --- Subtasks ---

export interface SubtaskRow {
  id: string;
  parent_item_id: string;
  content: string;
  done: boolean;
  sort_order: number;
}

export async function getSubtasks(itemId: string): Promise<SubtaskRow[]> {
  const res = await request<{ data: SubtaskRow[] }>(`/api/extracted-items/${itemId}/subtasks`);
  return res.data;
}

export async function createSubtask(itemId: string, content: string) {
  return request<{ data: SubtaskRow }>(`/api/extracted-items/${itemId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function updateSubtask(id: string, data: { content?: string; done?: boolean }) {
  return request<{ data: SubtaskRow }>(`/api/subtasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSubtask(id: string) {
  return request<{ ok: boolean }>(`/api/subtasks/${id}`, {
    method: "DELETE",
  });
}

// --- Admin actions ---

export async function triggerExtraction(meetingId: string) {
  return request<{ ok: boolean; itemCount: number; milestoneCount: number; projectIds: string[] }>(`/api/extract/${meetingId}`, { method: "POST" });
}

export async function triggerBatchExtraction() {
  return request<{ ok: boolean; summary: { total: number; succeeded: number; skipped: number; failed: number } }>("/api/extract/batch", { method: "POST" });
}

export async function triggerMatchMeetings() {
  return request<{ ok: boolean; summary: { totalProcessed: number; matched: number; unmatched: number } }>("/api/projects/match-meetings", { method: "POST" });
}
