export interface RowMeetingRaw {
  id?: string;
  meet_instance_key: string;
  event_id: string;
  eid: string;
  document_id: string;
  transcript_tab_id: string;
  transcript_title: string;
  transcript: string;
  summary: string;
  char_count: number;
  event_summary: string;
  event_start: string;
  event_end: string;
  event_organizer_email: string;
  event_html_link: string;
  attendee_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface TfMeetingAttendee {
  id?: string;
  meet_instance_key: string;
  email: string;
  display_name: string;
  response_status: string;
  is_organizer: boolean;
  person_id: string | null;
  resolve_method: "email_exact" | "unresolved";
  confidence: number;
  created_at?: string;
  updated_at?: string;
}

export interface TfIndividualScoreInput {
  id?: string;
  meet_instance_key: string;
  email: string;
  display_name: string;
  transcript: string;
  event_summary: string;
  event_start: string;
  event_end: string;
  attendee_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface MasterPersonIdentity {
  id: string;
  email: string;
  display_name: string;
  department?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}
