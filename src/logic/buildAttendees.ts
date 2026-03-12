import type { CalendarAttendee } from "../services/googleCalendar.js";
import type { TfMeetingAttendee, MasterPersonIdentity } from "../types/meeting.js";
import { normalizeEmail } from "../utils/emailNormalizer.js";

export function buildAttendees(
  calendarAttendees: CalendarAttendee[],
  personIdentities: MasterPersonIdentity[],
): TfMeetingAttendee[] {
  const identityMap = new Map<string, MasterPersonIdentity>();
  for (const person of personIdentities) {
    identityMap.set(normalizeEmail(person.email), person);
  }

  return calendarAttendees.map((attendee) => {
    const normalizedEmail = normalizeEmail(attendee.email);
    const identity = identityMap.get(normalizedEmail);

    return {
      meet_instance_key: "", // set by caller
      email: normalizedEmail,
      display_name: identity?.display_name ?? attendee.displayName ?? "",
      response_status: attendee.responseStatus ?? "",
      is_organizer: attendee.organizer ?? false,
      person_id: identity?.id ?? null,
      resolve_method: identity ? "email_exact" as const : "unresolved" as const,
      confidence: identity ? 1 : 0,
    };
  });
}
