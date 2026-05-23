/** Pure helpers for Skipper voice-operational queries (no server-only). */

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function summarizeConversationText(messages: string[], maxLen = 160): string {
  const userLines = messages.map((m) => m.trim()).filter(Boolean);
  if (!userLines.length) return "a general inquiry";
  const joined = userLines.join(" · ");
  if (joined.length <= maxLen) return joined;
  return `${joined.slice(0, maxLen - 1)}…`;
}

export function formatVoiceTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
