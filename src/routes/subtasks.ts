import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

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

// GET /api/extracted-items/:itemId/subtasks
router.get("/api/extracted-items/:itemId/subtasks", auth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await sb()
      .from("pjhub_subtasks")
      .select("*")
      .eq("parent_item_id", req.params.itemId)
      .order("sort_order");
    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET subtasks failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "subtasks.list" } });
  }
});

// POST /api/extracted-items/:itemId/subtasks
router.post("/api/extracted-items/:itemId/subtasks", auth, async (req: Request, res: Response) => {
  try {
    const { content, sort_order } = req.body as { content: string; sort_order?: number };
    if (!content) {
      res.status(400).json({ ok: false, error: { code: "VALIDATION", message: "content is required", step: "subtasks.create" } });
      return;
    }
    const { data, error } = await sb()
      .from("pjhub_subtasks")
      .insert({
        parent_item_id: req.params.itemId,
        content,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    logger.info("Subtask created", { id: data.id, parentId: req.params.itemId });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST subtasks failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "subtasks.create" } });
  }
});

// PATCH /api/subtasks/:id
router.patch("/api/subtasks/:id", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as { content?: string; done?: boolean; sort_order?: number };
    const { data, error } = await sb()
      .from("pjhub_subtasks")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    logger.info("Subtask updated", { id: req.params.id });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH subtasks failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "subtasks.update" } });
  }
});

// DELETE /api/subtasks/:id
router.delete("/api/subtasks/:id", auth, async (req: Request, res: Response) => {
  try {
    const { error } = await sb()
      .from("pjhub_subtasks")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    logger.info("Subtask deleted", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("DELETE subtasks failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "subtasks.delete" } });
  }
});

export default router;
