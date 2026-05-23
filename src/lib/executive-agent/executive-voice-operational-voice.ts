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
    return "Nothing on Jarva's desk today so far, Boss.";
  }
  const first = rows[0]!;
  const name = first.accountDisplayName;
  const summary = first.conversationSummary;
  if (rows.length === 1) {
    return `Jarva spoke with ${name} today — they asked about ${summary}.`;
  }
  return `Jarva had ${rows.length} conversations today. Most recent was ${name}, asking about ${summary}. Say next if you want another.`;
}

export function buildRealityActivityVoiceAnswer(rows: RealityActivityRow[]): string {
  if (!rows.length) {
    return "No Reality chats today so far.";
  }
  const first = rows[0]!;
  if (rows.length === 1) {
    return `Reality spoke with ${first.userDisplayName} around ${formatVoiceTimestamp(first.timestamp)} about ${first.conversationSummary}.`;
  }
  return `Reality had ${rows.length} conversations today. Latest was ${first.userDisplayName} around ${formatVoiceTimestamp(first.timestamp)} — ${first.conversationSummary}.`;
}

export function buildExecutiveInboxVoiceAnswer(messages: ExecutiveInboxMessageRow[]): {
  answer: string;
  pendingAudio?: { messageId: string; attachmentId: string };
} {
  if (!messages.length) {
    return { answer: "Your inbox is quiet today — no new messages." };
  }
  const first = messages[0]!;
  const subject = first.subjectOrPreview.slice(0, 120);
  const sender = first.senderName;
  const when = formatVoiceTimestamp(first.receivedAt);
  const countLine =
    messages.length === 1
      ? "You have one new message in your inbox."
      : `You have ${messages.length} new messages in your inbox.`;
  let answer = `${countLine} The latest is from ${sender}, ${when}: ${subject}.`;
  if (first.hasAudioAttachment && first.firstAudioAttachmentId) {
    answer += " Want me to play the voice note?";
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
      ? ` We also had ${visitorsToday} new site visitor${visitorsToday === 1 ? "" : "s"} today.`
      : "";
  if (!rows.length) {
    return {
      answer: `No new sign-ups today.${visitorPart}`.trim(),
      offerPhone: false,
    };
  }
  const first = rows[0]!;
  const when = formatVoiceTimestamp(first.createdAt);
  const phoneHint = rows.some((r) => r.phoneAvailable)
    ? " Want their number for a personal follow-up?"
    : "";
  if (rows.length === 1) {
    return {
      answer: `One new sign-up today.${visitorPart} ${first.accountDisplayName} registered ${when}.${phoneHint}`.trim(),
      offerPhone: rows.some((r) => r.phoneAvailable),
    };
  }
  return {
    answer: `${rows.length} new sign-ups today.${visitorPart} Latest is ${first.accountDisplayName}, registered ${when}.${phoneHint}`.trim(),
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
  return `${row.accountDisplayName}, ${row.index} of ${row.total}. The number is ${spoken}. Say next, repeat, skip, or stop.`;
}

export function buildInboxAudioPlayAck(): string {
  return "Playing that now.";
}

export function buildInboxAudioDeclined(): string {
  return "No problem — I'll leave it in your inbox.";
}

export function buildPhoneQueueStopped(): string {
  return "Stopping there.";
}

export function buildPhoneQueueFinished(): string {
  return "That's everyone in the queue.";
}
