import { Router, type Request, type Response } from "express";
import { getConfig } from "../config.js";
import * as googleDocs from "../services/googleDocs.js";
import * as googleCalendar from "../services/googleCalendar.js";
import * as supabase from "../services/supabase.js";
import { extractTranscript } from "../logic/extractTranscript.js";
import { matchEvent } from "../logic/matchEvent.js";
import { buildRowData } from "../logic/buildRowData.js";
import { buildAttendees } from "../logic/buildAttendees.js";
import { buildIndividualInputs } from "../logic/buildIndividualInput.js";
import * as meetingEval from "../logic/meetingEval.js";
import * as individualEval from "../logic/individualEval.js";
import { buildMeetingReport, buildIndividualReports } from "../logic/reportFormatter.js";
import { getActiveCriteria } from "../services/scoring-criteria.js";
import { AppError } from "../types/api.js";
import type { ProcessMeetingRequest, ProcessMeetingResponse, ErrorResponse } from "../types/api.js";
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

router.post("/api/process-meeting", authenticateApiKey, async (req: Request, res: Response) => {
  const { fileId, calendarEmail } = req.body as ProcessMeetingRequest;

  if (!fileId) {
    res.status(400).json({ ok: false, error: { code: "MISSING_FILE_ID", message: "fileId is required", step: "validation" } });
    return;
  }

  try {
    const config = getConfig();
    const targetCalendar = calendarEmail ?? config.calendarId;
    const subjectEmail = calendarEmail || undefined;

    // 1. Docs取得 + Transcript抽出
    logger.info("Step 1: Fetching document", { fileId });
    const doc = await googleDocs.getDocument(fileId, subjectEmail);
    const extracted = extractTranscript(doc);

    // 2. Calendar照合
    logger.info("Step 2: Matching calendar event", { eid: extracted.eid, calendar: targetCalendar });
    const events = await googleCalendar.getEvents(targetCalendar, config.calendarLookbackDays, subjectEmail);
    const matched = matchEvent(events, extracted.eid);
    const eventDetail = await googleCalendar.getEvent(targetCalendar, matched.eventId, subjectEmail);

    // 3. ROW層: eval_meeting_raw UPSERT
    logger.info("Step 3: Saving row data", { meetInstanceKey: matched.meetInstanceKey });
    const rowData = buildRowData({ extracted, eventDetail, meetInstanceKey: matched.meetInstanceKey, eventId: matched.eventId });
    const savedRow = await supabase.upsertRowData(rowData);

    // 4. TRANSFORM層: attendees + individual input
    logger.info("Step 4: Building attendees and individual inputs");
    const personIdentities = await supabase.getPersonIdentities();
    const attendees = buildAttendees(eventDetail.attendees ?? [], personIdentities);
    await supabase.upsertAttendees(savedRow.meet_instance_key, attendees);
    const individualInputs = buildIndividualInputs(savedRow, attendees);
    await supabase.upsertIndividualInputs(individualInputs);

    // 5. OUTPUT層: 会議評価
    logger.info("Step 5: Running meeting evaluation");
    const meetingEvalResult = await meetingEval.run(savedRow);

    // 6. OUTPUT層: 個人評価 (順次)
    logger.info("Step 6: Running individual evaluations");
    const individualEvalResults = await individualEval.runAll(individualInputs);

    // 7. レポート生成 (dynamic criteria for report formatting)
    logger.info("Step 7: Building reports");
    const [meetingCriteria, individualCriteria] = await Promise.all([
      getActiveCriteria("meeting"),
      getActiveCriteria("individual"),
    ]);
    const meetingReport = buildMeetingReport(meetingEvalResult, attendees, savedRow.event_summary, meetingCriteria);
    const individualReports = buildIndividualReports(individualEvalResults, savedRow.event_summary, individualCriteria);

    const response: ProcessMeetingResponse = {
      ok: true,
      meetInstanceKey: savedRow.meet_instance_key,
      attendees,
      meetingReport,
      individualReports,
    };

    logger.info("Processing complete", { meetInstanceKey: savedRow.meet_instance_key });
    res.json(response);
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("AppError in processMeeting", { code: err.code, step: err.step, message: err.message });
      const cfg = getConfig();
      const errorResponse: ErrorResponse = {
        ok: false,
        error: { code: err.code, message: err.message, step: err.step },
        notification: cfg.adminEmail
          ? { to: cfg.adminEmail, subject: `会議処理エラー: ${err.code}`, text: `Step: ${err.step}\nError: ${err.message}` }
          : undefined,
      };
      res.status(err.statusCode).json(errorResponse);
    } else {
      const message = err instanceof Error ? err.message : (typeof err === "object" && err !== null && "message" in err) ? String((err as { message: unknown }).message) : JSON.stringify(err);
      logger.error("Unexpected error in processMeeting", { error: message });
      const errorResponse: ErrorResponse = {
        ok: false,
        error: { code: "INTERNAL_ERROR", message, step: "unknown" },
      };
      res.status(500).json(errorResponse);
    }
  }
});

export default router;
