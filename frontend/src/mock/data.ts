// Type-only file — mock data removed, API is now the data source.
// These types are kept for backward compatibility with components.

export interface Member {
  id: string;
  name: string;
  email: string;
}

export interface Phase {
  id: string;
  name: string;
  sort_order: number;
  start_date: string;
  end_date: string;
  actual_end_date: string | null;
  status: "completed" | "in_progress" | "not_started";
}

export interface Milestone {
  id: string;
  name: string;
  due_date: string;
  status: "pending" | "achieved";
  phase_id: string | null;
  source: "ai" | "manual";
}

export interface ProjectMember {
  member_id: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "on_hold" | "completed" | "archived";
  calendar_keywords: string[];
  start_date: string;
  end_date: string;
  members: ProjectMember[];
  phases: Phase[];
  milestones: Milestone[];
}

export interface AiOriginal {
  content: string;
  assignee?: string | null;
  due_date?: string | null;
  priority?: string;
  phase_completed?: string;
  phase_started?: string;
  source_quote?: string;
}

export interface ExtractedItem {
  id: string;
  meeting_id: string;
  project_id: string;
  type: "todo" | "decision" | "issue" | "phase_change";
  status: "draft" | "confirmed" | "rejected";
  content: string;
  assignee_member_id: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  ai_original: AiOriginal;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
}
