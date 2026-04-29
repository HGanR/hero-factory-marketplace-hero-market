import {
  X_BENTLEY_CLIENT_ID,
  X_BENTLEY_RUN_ID,
  X_BENTLEY_USER_ID,
} from "@/lib/revenue-os/bentley-correlation-headers";

const LOG_PREFIX = "[bentley-correlation]";

export type BentleyCorrelationParsed = {
  runId: string;
  userId: string | null;
  clientId: string | null;
};

export type BentleyCorrelationEvent = {
  scope: string;
  runId: string;
  userId: string | null;
  clientId: string | null;
  timestamp: string;
  extra?: Record<string, unknown>;
};

/**
 * Read Bentley correlation headers from a request (typically from browser pipeline fetches).
 * Returns null when no active run is indicated (no `x-bentley-run-id`).
 */
export function parseBentleyCorrelationHeaders(req: Request): BentleyCorrelationParsed | null {
  const runId = req.headers.get(X_BENTLEY_RUN_ID)?.trim();
  if (!runId) return null;
  const userId = req.headers.get(X_BENTLEY_USER_ID)?.trim() ?? null;
  const clientId = req.headers.get(X_BENTLEY_CLIENT_ID)?.trim() ?? null;
  return { runId, userId, clientId };
}

/**
 * Emit a single structured debug line for correlated Revenue OS / Bentley pipeline requests.
 * No-op when `x-bentley-run-id` is absent (normal UI traffic).
 *
 * Log line format: `[bentley-correlation] {"scope":"...","runId":"...",...}` (JSON object).
 */
export function logBentleyCorrelationEvent(
  scope: string,
  req: Request,
  extra?: Record<string, unknown>
): void {
  const parsed = parseBentleyCorrelationHeaders(req);
  if (!parsed) return;

  const event: BentleyCorrelationEvent = {
    scope,
    runId: parsed.runId,
    userId: parsed.userId,
    clientId: parsed.clientId,
    timestamp: new Date().toISOString(),
  };
  if (extra && Object.keys(extra).length > 0) {
    event.extra = extra;
  }

  console.info(LOG_PREFIX, JSON.stringify(event));
}
