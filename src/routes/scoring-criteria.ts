import { Router, type Request, type Response } from "express";
import { getConfig } from "../config.js";
import {
  getAllCriteria,
  getActiveCriteria,
  getCriteriaById,
  createCriteria,
  updateCriteria,
  getCriteriaHistory,
  buildCriteriaSnapshot,
} from "../services/scoring-criteria.js";
import { buildDynamicMeetingEvalPrompt } from "../prompts/dynamicMeetingEval.js";
import { buildDynamicIndividualEvalPrompt } from "../prompts/dynamicIndividualEval.js";
import { logger } from "../utils/logger.js";

const router = Router();

function authenticateApiKey(req: Request, res: Response, next: () => void): void {
  const config = getConfig();
  const apiKey =
    (req.headers["x-api-key"] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid API key", step: "auth" },
    });
    return;
  }
  next();
}

// GET /api/scoring-criteria — 一覧
router.get("/api/scoring-criteria", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const type = req.query.type as "meeting" | "individual" | undefined;
    const activeOnly = req.query.active === "true";

    let data;
    if (activeOnly && type) {
      data = await getActiveCriteria(type);
    } else {
      data = await getAllCriteria(type);
    }

    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error fetching criteria", { error: message });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

// GET /api/scoring-criteria/:id — 単体取得
router.get("/api/scoring-criteria/:id", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const data = await getCriteriaById(req.params.id as string);
    if (!data) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Criteria not found", step: "scoring-criteria" } });
      return;
    }
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error fetching criteria", { error: message });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

// POST /api/scoring-criteria — 新規作成
router.post("/api/scoring-criteria", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { type, key, name_ja, description_ja, weight, sort_order } = req.body;

    if (!type || !key || !name_ja || !description_ja) {
      res.status(400).json({
        ok: false,
        error: { code: "MISSING_PARAMS", message: "type, key, name_ja, description_ja are required", step: "validation" },
      });
      return;
    }

    if (!["meeting", "individual"].includes(type)) {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_PARAMS", message: "type must be 'meeting' or 'individual'", step: "validation" },
      });
      return;
    }

    const data = await createCriteria({ type, key, name_ja, description_ja, weight, sort_order });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error creating criteria", { error: message });
    const status = message.includes("duplicate") ? 409 : 500;
    res.status(status).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

// PATCH /api/scoring-criteria/:id — 更新
router.patch("/api/scoring-criteria/:id", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { name_ja, description_ja, weight, sort_order, is_active } = req.body;
    const data = await updateCriteria(req.params.id as string, { name_ja, description_ja, weight, sort_order, is_active });
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error updating criteria", { error: message });
    const status = message.includes("not found") ? 404 : 500;
    res.status(status).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

// GET /api/scoring-criteria/:id/history — 変更履歴
router.get("/api/scoring-criteria/:id/history", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const data = await getCriteriaHistory(req.params.id as string);
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error fetching criteria history", { error: message });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

// POST /api/scoring-criteria/preview-prompt — プロンプトプレビュー生成
router.post("/api/scoring-criteria/preview-prompt", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const type = req.body.type as "meeting" | "individual" | undefined;
    if (!type || !["meeting", "individual"].includes(type)) {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_PARAMS", message: "type must be 'meeting' or 'individual'", step: "validation" },
      });
      return;
    }

    const criteria = await getActiveCriteria(type);

    const sampleInput = {
      eventSummary: "【サンプル】週次定例会議",
      eventStart: "2025-01-15T10:00:00+09:00",
      eventEnd: "2025-01-15T11:00:00+09:00",
      attendeeCount: 5,
      charCount: 10000,
      transcript: "（プレビュー用サンプル — 実際の文字起こしがここに入ります）",
    };

    let prompt: string;
    if (type === "meeting") {
      prompt = buildDynamicMeetingEvalPrompt(criteria, sampleInput);
    } else {
      prompt = buildDynamicIndividualEvalPrompt(criteria, {
        displayName: "山田 太郎",
        email: "taro.yamada@example.com",
        eventSummary: sampleInput.eventSummary,
        eventStart: sampleInput.eventStart,
        eventEnd: sampleInput.eventEnd,
        attendeeCount: sampleInput.attendeeCount,
        transcript: sampleInput.transcript,
      });
    }

    res.json({ ok: true, data: { type, criteriaCount: criteria.length, prompt } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error generating prompt preview", { error: message });
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message, step: "scoring-criteria" } });
  }
});

export default router;
