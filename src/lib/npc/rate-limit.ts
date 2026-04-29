/**
 * Simple in-memory rate limiter for NPC chat.
 * Best-effort for single-instance deploys. For production at scale, use Redis or DB-backed limiting.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

function pruneStale() {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (entry.resetAt < now) windows.delete(key);
  }
}

export function checkRateLimit(userId: number): { allowed: boolean; retryAfterSec?: number } {
  const key = `user:${userId}`;
  const now = Date.now();

  if (windows.size > 1000) pruneStale();

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
