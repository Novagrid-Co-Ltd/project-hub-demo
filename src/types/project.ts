export interface Project {
  id?: string;
  name: string;
  description: string;
  status: "active" | "on_hold" | "completed" | "archived";
  calendar_keywords: string[];
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectMember {
  id?: string;
  project_id: string;
  member_id: string;
  role: string;
  joined_at?: string;
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  calendar_keywords?: string[];
  start_date?: string | null;
  end_date?: string | null;
  members?: { member_id: string; role: string }[];
  phases?: { name: string; sort_order: number; start_date?: string | null; end_date?: string | null }[];
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  status?: "active" | "on_hold" | "completed" | "archived";
  calendar_keywords?: string[];
  start_date?: string | null;
  end_date?: string | null;
}

export interface ProjectMeetingRow {
  id?: string;
  project_id: string;
  meeting_id: string;
  matched_by: "manual" | "ai";
  created_at?: string;
}
