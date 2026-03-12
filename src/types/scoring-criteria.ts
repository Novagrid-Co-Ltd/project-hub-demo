export interface ScoringCriteria {
  id: string;
  type: "meeting" | "individual";
  key: string;
  name_ja: string;
  description_ja: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ScoringCriteriaHistory {
  id: string;
  criteria_id: string;
  action: "created" | "updated" | "deactivated" | "reactivated";
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string;
  created_at: string;
}

export interface CriteriaSnapshot {
  criteria: {
    key: string;
    name_ja: string;
    description_ja: string;
    weight: number;
  }[];
  snapshot_at: string;
}

export type DynamicScores = Record<string, number>;

export interface CreateCriteriaInput {
  type: "meeting" | "individual";
  key: string;
  name_ja: string;
  description_ja: string;
  weight?: number;
  sort_order?: number;
}

export interface UpdateCriteriaInput {
  name_ja?: string;
  description_ja?: string;
  weight?: number;
  sort_order?: number;
  is_active?: boolean;
}
