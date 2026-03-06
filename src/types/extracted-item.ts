export interface AiOriginal {
  content: string;
  assignee?: string | null;
  due_date?: string | null;
  priority?: string;
  source_quote?: string;
  phase_completed?: string;
  phase_started?: string;
}

export interface ExtractedItem {
  id?: string;
  meeting_id: string;
  project_id: string | null;
  type: "todo" | "decision" | "issue" | "phase_change";
  status: "draft" | "confirmed" | "rejected";
  ai_original: AiOriginal;
  content: string;
  assignee_member_id: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractedItemUpdateRequest {
  content?: string;
  assignee_member_id?: string | null;
  due_date?: string | null;
  priority?: "high" | "medium" | "low";
  milestone_id?: string | null;
}

export interface ExtractionResultItem {
  type: "todo" | "decision" | "issue" | "phase_change";
  content: string;
  assignee: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  source_quote: string;
  phase_completed?: string | null;
  phase_started?: string | null;
}

export interface ExtractionResultMilestone {
  name: string;
  due_date: string | null;
  phase_name: string | null;
  source_quote: string;
}

export interface ExtractionResult {
  items: ExtractionResultItem[];
  milestones: ExtractionResultMilestone[];
}
