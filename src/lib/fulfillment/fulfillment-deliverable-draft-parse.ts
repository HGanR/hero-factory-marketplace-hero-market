import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";

const PREVIEW_MAX = 4000;

export function parseFulfillmentOrderIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = p.fulfillmentOrderId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function parseSiteBuilderNoteFields(noteText: string): {
  title: string | null;
  priority: string | null;
  body: string;
} {
  const title = noteText.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const priority = noteText.match(/^Priority:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const bodyStart = noteText.indexOf("\n\n");
  const body =
    bodyStart >= 0
      ? noteText.slice(bodyStart).replace(/\(No live site schema mutation from this action\.\)\s*$/i, "").trim()
      : noteText;
  return { title, priority, body: redactSensitiveIntakeText(body) };
}

export function buildDraftPreviewText(noteText: string): string {
  const { title, priority, body } = parseSiteBuilderNoteFields(noteText);
  const parts = [
    title ? `Title: ${title}` : null,
    priority ? `Priority: ${priority}` : null,
    body || null,
  ].filter((p): p is string => Boolean(p));
  const joined = parts.join("\n\n");
  return joined.length <= PREVIEW_MAX ? joined : `${joined.slice(0, PREVIEW_MAX - 1)}…`;
}
