/**
 * Rate limiter for campaign-from-notes (expensive LLM endpoint).
 * Keys by consultant/user/client/workspace or IP for anonymous.
 * Best-effort for single-instance deploys; use Redis for production scale.
 */

const WINDOW_MS = 15 * 60_000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

function pruneStale() {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (entry.resetAt < now) windows.delete(key);
  }
}

export function checkCampaignRateLimit(limitKey: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const key = `campaign:${limitKey}`;
  const now = Date.now();

  if (windows.size > 2000) pruneStale();

  let entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    windows.set(key, entry);
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count <= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}
