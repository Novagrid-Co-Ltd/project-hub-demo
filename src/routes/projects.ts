import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ProjectCreateRequest, ProjectUpdateRequest } from "../types/project.js";

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

// GET /api/projects
router.get("/api/projects", auth, async (_req: Request, res: Response) => {
  try {
    const { data: projects, error } = await sb()
      .from("projects")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Enrich with draft count and current phase
    const enriched = await Promise.all(
      (projects ?? []).map(async (p) => {
        const [draftRes, phaseRes] = await Promise.all([
          sb()
            .from("extracted_items")
            .select("id", { count: "exact", head: true })
            .eq("project_id", p.id)
            .eq("status", "draft"),
          sb()
            .from("phases")
            .select("name")
            .eq("project_id", p.id)
            .eq("status", "in_progress")
            .limit(1)
            .maybeSingle(),
        ]);
        return {
          ...p,
          draft_item_count: draftRes.count ?? 0,
          current_phase: phaseRes.data?.name ?? null,
        };
      })
    );

    res.json({ ok: true, data: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET /api/projects failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "projects.list" } });
  }
});

// GET /api/projects/:id
router.get("/api/projects/:id", auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: project, error } = await sb()
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;

    const [membersRes, phasesRes, milestonesRes, pmRes] = await Promise.all([
      sb()
        .from("project_members")
        .select("*, master_person_identity(id, display_name, email)")
        .eq("project_id", id),
      sb()
        .from("phases")
        .select("*")
        .eq("project_id", id)
        .order("sort_order"),
      sb()
        .from("milestones")
        .select("*")
        .eq("project_id", id)
        .order("due_date"),
      sb()
        .from("project_meetings")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Manual join: project_meetings -> row_meeting_raw (no FK)
    const pmRows = pmRes.data ?? [];
    let meetings: unknown[] = pmRows;
    if (pmRows.length > 0) {
      const meetingIds = pmRows.map((r: { meeting_id: string }) => r.meeting_id);
      const { data: rawMeetings } = await sb()
        .from("row_meeting_raw")
        .select("id, event_summary, event_start, event_end, attendee_count")
        .in("id", meetingIds);
      const meetingMap = new Map<string, unknown>();
      for (const m of rawMeetings ?? []) meetingMap.set((m as { id: string }).id, m);
      meetings = pmRows.map((r: { meeting_id: string }) => ({
        ...r,
        row_meeting_raw: meetingMap.get(r.meeting_id) ?? null,
      }));
    }

    res.json({
      ok: true,
      data: {
        ...project,
        members: membersRes.data ?? [],
        phases: phasesRes.data ?? [],
        milestones: milestonesRes.data ?? [],
        meetings,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("GET /api/projects/:id failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "projects.get" } });
  }
});

// POST /api/projects
router.post("/api/projects", auth, async (req: Request, res: Response) => {
  try {
    const body = req.body as ProjectCreateRequest;

    if (!body.name) {
      res.status(400).json({ ok: false, error: { code: "VALIDATION", message: "name is required", step: "projects.create" } });
      return;
    }

    // 1. Insert project
    const { data: project, error: projectErr } = await sb()
      .from("projects")
      .insert({
        name: body.name,
        description: body.description ?? "",
        calendar_keywords: body.calendar_keywords ?? [],
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
      })
      .select()
      .single();
    if (projectErr) throw projectErr;

    // 2. Insert members
    if (body.members && body.members.length > 0) {
      const memberRows = body.members.map((m) => ({
        project_id: project.id,
        member_id: m.member_id,
        role: m.role,
      }));
      const { error: memberErr } = await sb().from("project_members").insert(memberRows);
      if (memberErr) throw memberErr;
    }

    // 3. Insert phases
    if (body.phases && body.phases.length > 0) {
      const phaseRows = body.phases.map((p) => ({
        project_id: project.id,
        name: p.name,
        sort_order: p.sort_order,
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
      }));
      const { error: phaseErr } = await sb().from("phases").insert(phaseRows);
      if (phaseErr) throw phaseErr;
    }

    logger.info("Project created", { projectId: project.id, name: body.name });
    res.status(201).json({ ok: true, data: project });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("POST /api/projects failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "projects.create" } });
  }
});

// PATCH /api/projects/:id
router.patch("/api/projects/:id", auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as ProjectUpdateRequest;

    const { data, error } = await sb()
      .from("projects")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    logger.info("Project updated", { projectId: id });
    res.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PATCH /api/projects/:id failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "projects.update" } });
  }
});

// DELETE /api/projects/:id (logical)
router.delete("/api/projects/:id", auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await sb()
      .from("projects")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) throw error;

    logger.info("Project archived", { projectId: id });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("DELETE /api/projects/:id failed", { error: msg });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg, step: "projects.delete" } });
  }
});

export default router;
