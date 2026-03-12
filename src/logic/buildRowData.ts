import type { CalendarEvent } from "../services/googleCalendar.js";
import type { RowMeetingRaw } from "../types/meeting.js";
import type { ExtractedTranscript } from "./extractTranscript.js";

interface BuildRowDataInput {
  extracted: ExtractedTranscript;
  eventDetail: CalendarEvent;
  meetInstanceKey: string;
  eventId: string;
}

export function buildRowData(input: BuildRowDataInput): RowMeetingRaw {
  const { extracted, eventDetail, meetInstanceKey, eventId } = input;
  return {
    meet_instance_key: meetInstanceKey,
    event_id: eventId,
    eid: extracted.eid,
    document_id: extracted.documentId,
    transcript_tab_id: extracted.transcriptTabId,
    transcript_title: extracted.transcriptTitle,
    transcript: extracted.transcript,
    summary: extracted.summary,
    char_count: extracted.charCount,
    event_summary: eventDetail.summary ?? "",
    event_start: eventDetail.start?.dateTime ?? eventDetail.start?.date ?? "",
    event_end: eventDetail.end?.dateTime ?? eventDetail.end?.date ?? "",
    event_organizer_email: eventDetail.organizer?.email ?? "",
    event_html_link: eventDetail.htmlLink ?? "",
    attendee_count: eventDetail.attendees?.length ?? 0,
  };
}
