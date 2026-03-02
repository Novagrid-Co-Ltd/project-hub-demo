export interface Phase {
  id?: string;
  project_id: string;
  name: string;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  status: "not_started" | "in_progress" | "completed";
  created_by: "manual" | "ai";
  created_at?: string;
  updated_at?: string;
}

export interface PhaseCreateRequest {
  name: string;
  sort_order?: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: "not_started" | "in_progress" | "completed";
}

export interface PhaseUpdateRequest {
  name?: string;
  sort_order?: number;
  start_date?: string | null;
  end_date?: string | null;
  actual_end_date?: string | null;
  status?: "not_started" | "in_progress" | "completed";
}
