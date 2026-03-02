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

// GET /api/projects/:projectId/meetings
router.get("/api/projects/:projectId/meetings", auth, async (req: Request, res: Response) => {
  try {
    // No FK between project_meetings and row_meeting_raw, so manual join
    const { data: pmRows, error } = await sb()
      .from("project_meetings")
      .select("*")
      .eq("project_id", req.params.projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = pmRows ?? [];
    if (rows.length === 0) {
      res.json({ ok: true, data: [] });
      return;
    }

    const meetingIds = rows.map((r: { meeting_id: string }) => r.meeting_id);
    const { data: meetings } = await sb()
      .from("row_meeting_raw")
      .select("id, event_summary, event_start, event_end, attendee_count")
      .in("id", meetingIds);

    const meetingMap = new Map<string, unknown>();
    for (const m of meetings ?? []) {
      meetingMap.set((m as { id: string }).id, m);
    }

    const combined = rows.map((r: { meeting_id: string }) => ({
      ...r,
      row_meeting_raw: meetingMap.get(r.meeting_id) ?? null,
    }));

    res.json({ ok: true, data: combined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET project meetings failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "project-meetings.list" } });
  }
});

// POST /api/projects/:projectId/meetings
router.post("/api/projects/:projectId/meetings", auth, async (req: Request, res: Response) => {
  try {
    const { meeting_id } = req.body as { meeting_id: string };
    if (!meeting_id) {
      res.status(400).json({ ok: false, error: { code: "VALIDATION", message: "meeting_id is required", step: "project-meetings.create" } });
      return;
    }

    const { data, error } = await sb()
      .from("project_meetings")
      .upsert(
        { project_id: req.params.projectId, meeting_id, matched_by: "manual" },
        { onConflict: "project_id,meeting_id" }
      )
      .select()
      .single();
    if (error) throw error;
    logger.info("Project meeting linked", { projectId: req.params.projectId, meetingId: meeting_id });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST project meetings failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "project-meetings.create" } });
  }
});

export default router;
