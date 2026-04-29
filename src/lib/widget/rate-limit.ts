/**
 * In-memory rate limiter for widget endpoints.
 * Use Upstash Redis in production for multi-instance consistency.
 */

const LIMIT = 30;
const WINDOW_MS = 60 * 1000; // 1 minute

const store = new Map<string, { count: number; resetAt: number }>();

function getKey(ip: string, widgetKey: string): string {
  return `${ip}:${widgetKey}`;
}

export function checkRateLimit(ip: string, widgetKey: string): { ok: boolean; retryAfter?: number } {
  const key = getKey(ip, widgetKey);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= LIMIT) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}
