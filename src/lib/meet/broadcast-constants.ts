/**
 * Single source of truth for broadcast timing thresholds (server monotonic clock).
 * All comparisons use `Date.now()` vs DB timestamps (`createdAt` / `startedAt` / `updatedAt` in UTC).
 */

/** `starting` + empty egress id: treat as abandoned after this age. */
export const BROADCAST_STUCK_STARTING_MS = 120_000;

/**
 * DB says live + non-empty egress id, but egress id not returned by LiveKit `listEgress` for the room:
 * wait this long before treating as zombie (API / indexing lag).
 */
export const BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS = 90_000;

/** Session rows in these statuses are treated as an in-flight or live broadcast. */
export const BROADCAST_LIVE_STATUSES = ["starting", "active"] as const;
