import { Router, type Request, type Response } from "express";
import { getConfig } from "../config.js";
import { fetchMonthlyData, aggregateMonthlyData } from "../logic/monthlyAggregation.js";
import { buildMonthlySummaryReport, buildMonthlyIndividualReports } from "../logic/monthlyReportFormatter.js";
import { getActiveCriteria } from "../services/scoring-criteria.js";
import type { MonthlyReportRequest, MonthlyReportResponse, ErrorResponse } from "../types/api.js";
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

router.post("/api/monthly-report", authenticateApiKey, async (req: Request, res: Response) => {
  const { year, month } = req.body as MonthlyReportRequest;

  // Validation
  if (!year || !month) {
    res.status(400).json({
      ok: false,
      error: { code: "MISSING_PARAMS", message: "year and month are required", step: "validation" },
    });
    return;
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_PARAMS", message: "year must be integer, month must be 1-12", step: "validation" },
    });
    return;
  }

  try {
    logger.info("Monthly report requested", { year, month });

    // Fetch active criteria for dynamic axis resolution
    const [rawData, meetingCriteria, individualCriteria] = await Promise.all([
      fetchMonthlyData(year, month),
      getActiveCriteria("meeting"),
      getActiveCriteria("individual"),
    ]);

    if (rawData.meetings.length === 0) {
      res.status(404).json({
        ok: false,
        error: { code: "NO_DATA", message: `No meetings found for ${year}-${String(month).padStart(2, "0")}`, step: "fetch" },
      });
      return;
    }

    // Aggregate with dynamic criteria
    const aggregated = aggregateMonthlyData(rawData, meetingCriteria, individualCriteria);

    // Build reports
    const meetingSummaryReport = buildMonthlySummaryReport(aggregated);
    const individualReports = buildMonthlyIndividualReports(aggregated);

    const period = `${year}-${String(month).padStart(2, "0")}`;

    const response: MonthlyReportResponse = {
      ok: true,
      period,
      meetingCount: aggregated.meetingCount,
      participantCount: aggregated.participantEmails.length,
      meetingSummaryReport,
      individualReports,
    };

    logger.info("Monthly report generated", { period, meetingCount: aggregated.meetingCount, individualReports: individualReports.length });
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    logger.error("Error generating monthly report", { error: message });
    const errorResponse: ErrorResponse = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message, step: "monthly-report" },
    };
    res.status(500).json(errorResponse);
  }
});

export default router;
