import type { RowMeetingRaw, TfMeetingAttendee, TfIndividualScoreInput } from "../types/meeting.js";
import { logger } from "../utils/logger.js";

/**
 * 文字起こしに発言が確認できる参加者のみを個人評価対象にする。
 * display_name（フルネーム・姓・名）やメールのローカルパートで検索し、
 * いずれかが文字起こし中に出現すれば「発言あり」と判定する。
 */
function hasSpeechInTranscript(attendee: TfMeetingAttendee, transcript: string): boolean {
  const name = attendee.display_name.trim();
  if (!name) return false;

  // フルネーム一致
  if (transcript.includes(name)) return true;

  // 姓・名の個別チェック（スペース区切り、2文字以上のパーツのみ）
  const parts = name.split(/[\s\u3000]+/).filter((p) => p.length >= 2);
  for (const part of parts) {
    if (transcript.includes(part)) return true;
  }

  // メールのローカルパート（ドット除去）で検索（Google Meetが英語名で記録する場合）
  const localPart = attendee.email.split("@")[0]?.replace(/\./g, "") ?? "";
  if (localPart.length >= 3 && transcript.toLowerCase().includes(localPart.toLowerCase())) {
    return true;
  }

  return false;
}

export function buildIndividualInputs(
  rowData: RowMeetingRaw,
  attendees: TfMeetingAttendee[],
): TfIndividualScoreInput[] {
  // 文字起こしに発言が確認できる参加者のみを評価対象にする
  const withSpeech = attendees.filter((a) => hasSpeechInTranscript(a, rowData.transcript));

  const skipped = attendees.length - withSpeech.length;
  if (skipped > 0) {
    const skippedNames = attendees
      .filter((a) => !hasSpeechInTranscript(a, rowData.transcript))
      .map((a) => a.display_name || a.email);
    logger.info("Skipped attendees without speech in transcript", {
      meet_instance_key: rowData.meet_instance_key,
      skipped,
      skippedNames,
    });
  }

  return withSpeech.map((attendee) => ({
    meet_instance_key: rowData.meet_instance_key,
    email: attendee.email,
    display_name: attendee.display_name,
    transcript: rowData.transcript,
    event_summary: rowData.event_summary,
    event_start: rowData.event_start,
    event_end: rowData.event_end,
    attendee_count: rowData.attendee_count,
  }));
}
