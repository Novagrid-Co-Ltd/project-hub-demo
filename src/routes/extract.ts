import { Router, type Request, type Response } from "express";
import { getConfig } from "../config.js";
import { extractForMeeting, extractBatch } from "../services/extraction.js";
import { matchAllUnlinkedMeetings } from "../services/project-matcher.js";
import { logger } from "../utils/logger.js";

const router = Router();

function authenticateApiKey(req: Request, res: Response, next: () => void): void {
  const config = getConfig();
  const apiKey =
    req.headers["x-api-key"] as string | undefined ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key", step: "auth" } });
    return;
  }
  next();
}

// POST /api/extract/batch - 未抽出の会議を一括抽出 (must be before :meetingId)
router.post("/api/extract/batch", authenticateApiKey, async (_req: Request, res: Response) => {
  try {
    logger.info("Batch extraction requested");
    const { results, summary } = await extractBatch();
    res.json({ ok: true, results, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Batch extraction failed", { error: message });
    res.status(500).json({ ok: false, error: { code: "BATCH_EXTRACTION_FAILED", message, step: "batch_extraction" } });
  }
});

// POST /api/extract/:meetingId - 指定会議の議事録から抽出
router.post("/api/extract/:meetingId", authenticateApiKey, async (req: Request, res: Response) => {
  const meetingId = req.params.meetingId as string;

  try {
    logger.info("Extraction requested", { meetingId });
    const result = await extractForMeeting(meetingId);
    res.json({
      ok: true,
      meetingId,
      items: result.items,
      itemCount: result.items.length,
      milestoneCount: result.milestoneCount,
      projectIds: result.projectIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Extraction failed", { meetingId, error: message });
    res.status(500).json({ ok: false, error: { code: "EXTRACTION_FAILED", message, step: "extraction" } });
  }
});

// POST /api/projects/match-meetings - 全PJのCalendarキーワードで未紐付け会議を一括マッチング
router.post("/api/projects/match-meetings", authenticateApiKey, async (_req: Request, res: Response) => {
  try {
    logger.info("Batch meeting matching requested");
    const matchResults = await matchAllUnlinkedMeetings();
    const matched = matchResults.filter((r) => r.matchedProjectIds.length > 0);
    res.json({
      ok: true,
      summary: {
        totalProcessed: matchResults.length,
        matched: matched.length,
        unmatched: matchResults.length - matched.length,
      },
      results: matchResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Batch meeting matching failed", { error: message });
    res.status(500).json({ ok: false, error: { code: "MATCH_FAILED", message, step: "match_meetings" } });
  }
});

export default router;
