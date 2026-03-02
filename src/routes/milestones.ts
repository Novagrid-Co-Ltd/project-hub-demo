import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { MilestoneCreateRequest, MilestoneUpdateRequest } from "../types/milestone.js";

const router = Router();

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    const cfg = getConfig();
    _sb = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
  }
  return _sb;
}

function auth(req: Request, res: Response, next: () => void): void {
  const cfg = getConfig();
  const key =
    (req.headers["x-api-key"] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!key || key !== cfg.apiKey) {
    res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key", step: "auth" } });
    return;
  }
  next();
}

// GET /api/projects/:projectId/milestones
router.get("/api/projects/:projectId/milestones", auth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await sb()
      .from("milestones")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("due_date");
    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET milestones failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "milestones.list" } });
  }
});

// POST /api/projects/:projectId/milestones
router.post("/api/projects/:projectId/milestones", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as MilestoneCreateRequest;
    const { data, error } = await sb()
      .from("milestones")
      .insert({
        project_id: req.params.projectId,
        name: body.name,
        due_date: body.due_date ?? null,
        phase_id: body.phase_id ?? null,
        source: body.source ?? "manual",
        source_meeting_id: body.source_meeting_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    logger.info("Milestone created", { milestoneId: data.id });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST milestones failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "milestones.create" } });
  }
});

// PATCH /api/projects/:projectId/milestones/:milestoneId
router.patch("/api/projects/:projectId/milestones/:milestoneId", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as MilestoneUpdateRequest;
    const { data, error } = await sb()
      .from("milestones")
      .update(body)
      .eq("id", req.params.milestoneId)
      .eq("project_id", req.params.projectId)
      .select()
      .single();
    if (error) throw error;
    logger.info("Milestone updated", { milestoneId: req.params.milestoneId });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH milestones failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "milestones.update" } });
  }
});

// DELETE /api/projects/:projectId/milestones/:milestoneId
router.delete("/api/projects/:projectId/milestones/:milestoneId", auth, async (req: Request, res: Response) => {
  try {
    const { error } = await sb()
      .from("milestones")
      .delete()
      .eq("id", req.params.milestoneId)
      .eq("project_id", req.params.projectId);
    if (error) throw error;
    logger.info("Milestone deleted", { milestoneId: req.params.milestoneId });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("DELETE milestones failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "milestones.delete" } });
  }
});

export default router;
