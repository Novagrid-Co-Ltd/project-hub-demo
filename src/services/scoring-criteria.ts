import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import type {
  ScoringCriteria,
  ScoringCriteriaHistory,
  CriteriaSnapshot,
  CreateCriteriaInput,
  UpdateCriteriaInput,
} from "../types/scoring-criteria.js";
import { logger } from "../utils/logger.js";

function getSupabase(): SupabaseClient {
  const cfg = getConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
}

// --- Read ---

export async function getActiveCriteria(type: "meeting" | "individual"): Promise<ScoringCriteria[]> {
  const { data, error } = await getSupabase()
    .from("eval_scoring_criteria")
    .select("*")
    .eq("type", type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScoringCriteria[];
}

export async function getAllCriteria(type?: "meeting" | "individual"): Promise<ScoringCriteria[]> {
  let query = getSupabase().from("eval_scoring_criteria").select("*");
  if (type) query = query.eq("type", type);
  query = query.order("type").order("sort_order", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScoringCriteria[];
}

export async function getCriteriaById(id: string): Promise<ScoringCriteria | null> {
  const { data, error } = await getSupabase()
    .from("eval_scoring_criteria")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as ScoringCriteria;
}

// --- Write ---

export async function createCriteria(input: CreateCriteriaInput): Promise<ScoringCriteria> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("eval_scoring_criteria")
    .insert({
      type: input.type,
      key: input.key,
      name_ja: input.name_ja,
      description_ja: input.description_ja,
      weight: input.weight ?? 1.0,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;

  const created = data as ScoringCriteria;

  await sb.from("eval_scoring_criteria_history").insert({
    criteria_id: created.id,
    action: "created",
    old_values: null,
    new_values: {
      key: created.key,
      name_ja: created.name_ja,
      description_ja: created.description_ja,
      weight: created.weight,
      sort_order: created.sort_order,
      is_active: created.is_active,
    },
    changed_by: "api",
  });

  logger.info("Created scoring criteria", { id: created.id, type: created.type, key: created.key });
  return created;
}

export async function updateCriteria(id: string, input: UpdateCriteriaInput): Promise<ScoringCriteria> {
  const sb = getSupabase();

  const existing = await getCriteriaById(id);
  if (!existing) throw new Error(`Criteria not found: ${id}`);

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const updatePayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && (existing as unknown as Record<string, unknown>)[key] !== value) {
      oldValues[key] = (existing as unknown as Record<string, unknown>)[key];
      newValues[key] = value;
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return existing;
  }

  const { data, error } = await sb
    .from("eval_scoring_criteria")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  const updated = data as ScoringCriteria;

  // Determine action type
  let action: string = "updated";
  if ("is_active" in input) {
    action = input.is_active ? "reactivated" : "deactivated";
  }

  await sb.from("eval_scoring_criteria_history").insert({
    criteria_id: id,
    action,
    old_values: oldValues,
    new_values: newValues,
    changed_by: "api",
  });

  logger.info("Updated scoring criteria", { id, action, changes: Object.keys(updatePayload) });
  return updated;
}

// --- History ---

export async function getCriteriaHistory(criteriaId: string): Promise<ScoringCriteriaHistory[]> {
  const { data, error } = await getSupabase()
    .from("eval_scoring_criteria_history")
    .select("*")
    .eq("criteria_id", criteriaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScoringCriteriaHistory[];
}

// --- Snapshot ---

export function buildCriteriaSnapshot(criteria: ScoringCriteria[]): CriteriaSnapshot {
  return {
    criteria: criteria.map((c) => ({
      key: c.key,
      name_ja: c.name_ja,
      description_ja: c.description_ja,
      weight: c.weight,
    })),
    snapshot_at: new Date().toISOString(),
  };
}
