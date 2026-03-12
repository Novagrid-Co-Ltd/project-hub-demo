import type { CalendarEvent } from "../services/googleCalendar.js";
import { AppError } from "../types/api.js";

export interface MatchedEvent {
  eventId: string;
  meetInstanceKey: string;
}

function extractEidFromHtmlLink(htmlLink: string): string | null {
  const match = htmlLink.match(/[?&]eid=([A-Za-z0-9_-]+)/);
  return match ? match[1]! : null;
}

export function matchEvent(events: CalendarEvent[], targetEid: string): MatchedEvent {
  for (const event of events) {
    if (!event.htmlLink) continue;
    const eventEid = extractEidFromHtmlLink(event.htmlLink);
    if (eventEid === targetEid) {
      const startTime = event.start?.dateTime ?? event.start?.date ?? "";
      return {
        eventId: event.id,
        meetInstanceKey: `${event.id}__${startTime}`,
      };
    }
  }

  throw new AppError({
    code: "EVENT_NOT_MATCHED",
    message: `No calendar event found matching eid: ${targetEid}`,
    step: "matchEvent",
    statusCode: 404,
  });
}
