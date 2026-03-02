import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ExtractedItemUpdateRequest } from "../types/extracted-item.js";

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

// GET /api/extracted-items?project_id=xxx&status=draft
router.get("/api/extracted-items", auth, async (req: Request, res: Response) => {
  try {
    let query = sb().from("extracted_items").select("*").order("created_at", { ascending: false });

    const projectId = req.query.project_id as string | undefined;
    if (projectId) query = query.eq("project_id", projectId);

    const status = req.query.status as string | undefined;
    if (status) query = query.eq("status", status);

    const type = req.query.type as string | undefined;
    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET /api/extracted-items failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "extracted-items.list" } });
  }
});

// PATCH /api/extracted-items/:id
router.patch("/api/extracted-items/:id", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as ExtractedItemUpdateRequest;
    const { data, error } = await sb()
      .from("extracted_items")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    logger.info("ExtractedItem updated", { id: req.params.id });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH /api/extracted-items/:id failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "extracted-items.update" } });
  }
});

// PATCH /api/extracted-items/:id/confirm
router.patch("/api/extracted-items/:id/confirm", auth, async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;

    // Fetch the item first
    const { data: item, error: fetchErr } = await sb()
      .from("extracted_items")
      .select("*")
      .eq("id", itemId)
      .single();
    if (fetchErr) throw fetchErr;

    // Update status
    const { data, error } = await sb()
      .from("extracted_items")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;

    // If phase_change, update the corresponding phase
    if (item.type === "phase_change" && item.project_id) {
      const aiOriginal = item.ai_original as { phase_completed?: string; phase_started?: string };

      if (aiOriginal.phase_completed) {
        // Mark completed phase
        const { error: completeErr } = await sb()
          .from("phases")
          .update({ status: "completed", actual_end_date: new Date().toISOString().slice(0, 10) })
          .eq("project_id", item.project_id)
          .eq("name", aiOriginal.phase_completed)
          .eq("status", "in_progress");
        if (completeErr) logger.warn("Failed to complete phase", { error: completeErr.message });
      }

      if (aiOriginal.phase_started) {
        // Mark started phase
        const { error: startErr } = await sb()
          .from("phases")
          .update({ status: "in_progress" })
          .eq("project_id", item.project_id)
          .eq("name", aiOriginal.phase_started)
          .eq("status", "not_started");
        if (startErr) logger.warn("Failed to start phase", { error: startErr.message });
      }

      logger.info("Phase change confirmed", {
        itemId,
        completed: aiOriginal.phase_completed,
        started: aiOriginal.phase_started,
      });
    }

    logger.info("ExtractedItem confirmed", { id: itemId });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH /api/extracted-items/:id/confirm failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "extracted-items.confirm" } });
  }
});

// PATCH /api/extracted-items/:id/reject
router.patch("/api/extracted-items/:id/reject", auth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await sb()
      .from("extracted_items")
      .update({ status: "rejected" })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    logger.info("ExtractedItem rejected", { id: req.params.id });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH /api/extracted-items/:id/reject failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "extracted-items.reject" } });
  }
});

export default router;
