import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";
import {
  TRUST_REVIEW_PACKET_NOTE_MARKER,
  TRUST_SETUP_BRIEF_NOTE_MARKER,
} from "@/lib/fulfillment/fulfillment-trust-legal";
import { TRUST_FULFILLMENT_LEGAL_BANNER } from "@/lib/fulfillment/fulfillment-trust-legal";

const PREVIEW_MAX = 5000;

export function parseFulfillmentOrderIdFromTrustPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = p.fulfillmentOrderId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function isTrustFulfillmentNote(noteText: string): boolean {
  return (
    noteText.includes(TRUST_REVIEW_PACKET_NOTE_MARKER) ||
    noteText.includes(TRUST_SETUP_BRIEF_NOTE_MARKER)
  );
}

export function parseTrustFulfillmentNoteFields(noteText: string): {
  title: string | null;
  priority: string | null;
  packetType: string | null;
  body: string;
  hasLegalDisclaimer: boolean;
} {
  const title = noteText.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const priority = noteText.match(/^Priority:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const packetType = noteText.match(/^Packet type:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const bodyStart = noteText.indexOf("\n\n");
  const body =
    bodyStart >= 0
      ? noteText
          .slice(bodyStart)
          .replace(/\(Internal fulfillment note only\.\)\s*$/i, "")
          .trim()
      : noteText;
  const hasLegalDisclaimer =
    noteText.includes(TRUST_FULFILLMENT_LEGAL_BANNER) ||
    /PREPARED FOR LEGAL REVIEW/i.test(noteText);
  return {
    title,
    priority,
    packetType,
    body: redactSensitiveIntakeText(body),
    hasLegalDisclaimer,
  };
}

export function buildTrustPacketPreviewText(noteText: string): string {
  const { title, priority, packetType, body } = parseTrustFulfillmentNoteFields(noteText);
  const parts = [
    title ? `Title: ${title}` : null,
    packetType ? `Packet type: ${packetType}` : null,
    priority ? `Priority: ${priority}` : null,
    body || null,
  ].filter((p): p is string => Boolean(p));
  const joined = parts.join("\n\n");
  return joined.length <= PREVIEW_MAX ? joined : `${joined.slice(0, PREVIEW_MAX - 1)}…`;
}
