export interface Milestone {
  id?: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  due_date: string | null;
  status: "pending" | "achieved";
  achieved_date: string | null;
  source: "manual" | "ai";
  source_meeting_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MilestoneCreateRequest {
  name: string;
  due_date?: string | null;
  phase_id?: string | null;
  source?: "manual" | "ai";
  source_meeting_id?: string | null;
}

export interface MilestoneUpdateRequest {
  name?: string;
  due_date?: string | null;
  phase_id?: string | null;
  status?: "pending" | "achieved";
  achieved_date?: string | null;
}
