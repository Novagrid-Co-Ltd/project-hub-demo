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

// GET /api/members
router.get("/api/members", auth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await sb()
      .from("master_person_identity")
      .select("id, display_name, email, department, role")
      .order("display_name");
    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET /api/members failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "members.list" } });
  }
});

// POST /api/projects/:projectId/members - メンバー追加
router.post("/api/projects/:projectId/members", auth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { member_id, role } = req.body as { member_id: string; role: string };

    if (!member_id) {
      res.status(400).json({ ok: false, error: { code: "VALIDATION", message: "member_id is required", step: "members.add" } });
      return;
    }

    const { data, error } = await sb()
      .from("project_members")
      .upsert({ project_id: projectId, member_id, role: role ?? "" }, { onConflict: "project_id,member_id" })
      .select()
      .single();

    if (error) throw error;

    logger.info("Member added to project", { projectId, member_id });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST /api/projects/:projectId/members failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "members.add" } });
  }
});

// PATCH /api/projects/:projectId/members/:memberId - ロール変更
router.patch("/api/projects/:projectId/members/:memberId", auth, async (req: Request, res: Response) => {
  try {
    const { projectId, memberId } = req.params;
    const { role } = req.body as { role: string };

    const { data, error } = await sb()
      .from("project_members")
      .update({ role })
      .eq("project_id", projectId)
      .eq("member_id", memberId)
      .select()
      .single();

    if (error) throw error;

    logger.info("Member role updated", { projectId, memberId, role });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH /api/projects/:projectId/members/:memberId failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "members.update" } });
  }
});

// DELETE /api/projects/:projectId/members/:memberId - メンバー削除
router.delete("/api/projects/:projectId/members/:memberId", auth, async (req: Request, res: Response) => {
  try {
    const { projectId, memberId } = req.params;

    const { error } = await sb()
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("member_id", memberId);

    if (error) throw error;

    logger.info("Member removed from project", { projectId, memberId });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("DELETE /api/projects/:projectId/members/:memberId failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "members.remove" } });
  }
});

export default router;
