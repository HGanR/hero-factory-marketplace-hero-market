/**
 * Chief-of-staff voice copy for Skipper operational queries (pure, testable).
 */

import { formatPhoneForVoice, formatVoiceTimestamp } from "@/lib/executive-agent/executive-voice-operational-utils";
import type {
  ExecutiveInboxMessageRow,
  JarvaActivityRow,
  NewRegistrationRow,
  RealityActivityRow,
} from "@/lib/executive-agent/executive-voice-operational-types";

export function buildJarvaActivityVoiceAnswer(rows: JarvaActivityRow[]): string {
  if (!rows.length) {
    return "No Boss, I do not see any Smart Trust or Jarva activity today.";
  }
  const first = rows[0]!;
  const name = first.accountDisplayName;
  const summary = first.conversationSummary;
  if (rows.length === 1) {
    return `Well Boss, so far today Jarva spoke with ${name}. The user asked Jarva about ${summary}.`;
  }
  return `Well Boss, Jarva had ${rows.length} conversations today. First up — ${name} asked about ${summary}. Say next for more.`;
}

export function buildRealityActivityVoiceAnswer(rows: RealityActivityRow[]): string {
  if (!rows.length) {
    return "No Boss, I do not see any Reality widget activity today.";
  }
  const first = rows[0]!;
  if (rows.length === 1) {
    return `Yes Boss, Reality spoke with ${first.userDisplayName} at ${formatVoiceTimestamp(first.timestamp)} about ${first.conversationSummary}.`;
  }
  return `Yes Boss, Reality had ${rows.length} conversations today. Latest — ${first.userDisplayName} at ${formatVoiceTimestamp(first.timestamp)}: ${first.conversationSummary}.`;
}

export function buildExecutiveInboxVoiceAnswer(messages: ExecutiveInboxMessageRow[]): {
  answer: string;
  pendingAudio?: { messageId: string; attachmentId: string };
} {
  if (!messages.length) {
    return { answer: "No Boss, the Executive Inbox has no new messages today." };
  }
  const first = messages[0]!;
  const subject = first.subjectOrPreview.slice(0, 120);
  const sender = first.senderName;
  const when = formatVoiceTimestamp(first.receivedAt);
  let answer = `Yes Boss, ${messages.length} new inbox signal${messages.length === 1 ? "" : "s"} today. Latest from ${sender} at ${when}: ${subject}.`;
  if (first.hasAudioAttachment && first.firstAudioAttachmentId) {
    answer += " Would you like me to play the audio file?";
    return {
      answer,
      pendingAudio: { messageId: first.messageId, attachmentId: first.firstAudioAttachmentId },
    };
  }
  return { answer };
}

export function buildNewRegistrationsVoiceAnswer(
  rows: NewRegistrationRow[],
  visitorsToday: number | null,
): { answer: string; offerPhone: boolean } {
  const visitorPart =
    visitorsToday != null && visitorsToday > 0
      ? ` I also count ${visitorsToday} new site visitor${visitorsToday === 1 ? "" : "s"} today.`
      : "";
  if (!rows.length) {
    return {
      answer: `No Boss, I do not see new registrations today.${visitorPart}`,
      offerPhone: false,
    };
  }
  const first = rows[0]!;
  const when = formatVoiceTimestamp(first.createdAt);
  const phoneHint = rows.some((r) => r.phoneAvailable) ? " Would you like the phone number for manual onboarding?" : "";
  if (rows.length === 1) {
    return {
      answer: `Yes Boss, there is a new registration.${visitorPart} ${first.accountDisplayName} registered at ${when}.${phoneHint}`,
      offerPhone: rows.some((r) => r.phoneAvailable),
    };
  }
  return {
    answer: `Yes Boss, there are ${rows.length} new registrations.${visitorPart} ${first.accountDisplayName} registered at ${when}.${phoneHint}`,
    offerPhone: rows.some((r) => r.phoneAvailable),
  };
}

export function buildRegistrationPhoneQueueVoiceLine(row: {
  accountDisplayName: string;
  phone: string;
  index: number;
  total: number;
}): string {
  const spoken = formatPhoneForVoice(row.phone);
  return `Contact ${row.index} of ${row.total}: ${row.accountDisplayName}. Phone: ${spoken}. Say next number, repeat number, skip, or stop.`;
}

export function buildInboxAudioPlayAck(): string {
  return "Understood Boss — playing the inbox audio now.";
}

export function buildInboxAudioDeclined(): string {
  return "Understood Boss — I will leave the audio on file.";
}

export function buildPhoneQueueStopped(): string {
  return "Stopping the phone queue, Boss.";
}

export function buildPhoneQueueFinished(): string {
  return "That was the last number in the queue, Boss.";
}
