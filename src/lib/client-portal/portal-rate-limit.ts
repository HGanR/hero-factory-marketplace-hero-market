type Bucket = { c: number; t: number };

const buckets = new Map<string, Bucket>();
const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MAX = 20;

/**
 * In-memory rate limit. Suited for serverless single-instance; production may need Redis.
 */
export function checkPortalRateLimit(
  key: string,
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.t > windowMs) {
    buckets.set(key, { c: 1, t: now });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.c >= max) {
    const left = windowMs - (now - b.t);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(left / 1000)) };
  }
  b.c += 1;
  return { ok: true, retryAfterSec: 0 };
}
