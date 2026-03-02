import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { PhaseCreateRequest, PhaseUpdateRequest } from "../types/phase.js";

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

// GET /api/projects/:projectId/phases
router.get("/api/projects/:projectId/phases", auth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await sb()
      .from("phases")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("sort_order");
    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET phases failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "phases.list" } });
  }
});

// POST /api/projects/:projectId/phases
router.post("/api/projects/:projectId/phases", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as PhaseCreateRequest;
    const { data, error } = await sb()
      .from("phases")
      .insert({
        project_id: req.params.projectId,
        name: body.name,
        sort_order: body.sort_order ?? 0,
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
        status: body.status ?? "not_started",
      })
      .select()
      .single();
    if (error) throw error;
    logger.info("Phase created", { phaseId: data.id });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST phases failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "phases.create" } });
  }
});

// PATCH /api/projects/:projectId/phases/:phaseId
router.patch("/api/projects/:projectId/phases/:phaseId", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as PhaseUpdateRequest;
    const { data, error } = await sb()
      .from("phases")
      .update(body)
      .eq("id", req.params.phaseId)
      .eq("project_id", req.params.projectId)
      .select()
      .single();
    if (error) throw error;
    logger.info("Phase updated", { phaseId: req.params.phaseId });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH phases failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "phases.update" } });
  }
});

// DELETE /api/projects/:projectId/phases/:phaseId
router.delete("/api/projects/:projectId/phases/:phaseId", auth, async (req: Request, res: Response) => {
  try {
    const { error } = await sb()
      .from("phases")
      .delete()
      .eq("id", req.params.phaseId)
      .eq("project_id", req.params.projectId);
    if (error) throw error;
    logger.info("Phase deleted", { phaseId: req.params.phaseId });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("DELETE phases failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "phases.delete" } });
  }
});

export default router;
