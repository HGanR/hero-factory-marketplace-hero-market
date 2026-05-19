/**
 * Redacts PII for admin executive surfaces — unit-tested.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function maskSnippet(text: string | null | undefined, maxLen = 140): string {
  if (text == null || text.trim() === "") return "";
  let s = text.replace(/\s+/g, " ").trim();
  s = s.replace(EMAIL_RE, "[redacted]");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

export function maskVisitorLabel(visitorId: string | null | undefined): string {
  if (!visitorId || visitorId.length < 4) return "Visitor";
  return `Visitor …${visitorId.slice(-4)}`;
}

export function maskUserIdLabel(userId: number | null | undefined): string {
  if (userId == null || !Number.isFinite(userId)) return "User";
  return `User #${userId}`;
}
