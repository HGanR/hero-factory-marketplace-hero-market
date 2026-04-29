/**
 * Compute a deterministic lastMessagePreview from message content.
 * All flows should use this so UI behavior is consistent.
 * Cap: 255 chars, strips newlines/collapses whitespace.
 */
export function computePreview(opts: {
  channel: string;
  subject?: string | null;
  bodyText?: string | null;
  fallback?: string;
}): string {
  const { channel, subject, bodyText, fallback = "—" } = opts;

  let raw = "";
  if (subject && subject.trim()) {
    raw = subject.trim();
  } else if (bodyText && bodyText.trim()) {
    raw = bodyText.trim();
  } else if (channel === "call" || channel === "voice") {
    raw = "Call";
  } else {
    raw = fallback;
  }

  const sanitized = raw.replace(/\s+/g, " ").trim();
  return sanitized.slice(0, 255);
}
