import { getAuthClient } from "./googleAuth.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../types/api.js";

export interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  organizer?: { email: string };
  attendees?: CalendarAttendee[];
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
}

interface EventListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

export async function getEvents(calendarId: string, lookbackDays: number, subjectEmail?: string): Promise<CalendarEvent[]> {
  const client = await getAuthClient(subjectEmail);
  const now = new Date();
  const timeMin = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;

  logger.info("Fetching calendar events", { calendarId, lookbackDays });

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: now.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await client.request<EventListResponse>({ url });

    if (res.data.items) {
      allEvents.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

export async function getEvent(calendarId: string, eventId: string, subjectEmail?: string): Promise<CalendarEvent> {
  const client = await getAuthClient(subjectEmail);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  logger.info("Fetching single calendar event", { calendarId, eventId });

  try {
    const res = await client.request<CalendarEvent>({ url });
    return res.data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      throw new AppError({
        code: "EVENT_NOT_FOUND",
        message: `カレンダーイベントが見つかりません (eventId: ${eventId})`,
        step: "fetch_event",
        statusCode: 404,
      });
    }
    throw err;
  }
}
