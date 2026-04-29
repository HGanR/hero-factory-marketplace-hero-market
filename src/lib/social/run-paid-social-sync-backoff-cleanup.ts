/**
 * Remove expired persisted cooldown rows (Part 53). Rows with `backoff_until` in the past are deleted.
 */

import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { paidSocialSyncBackoffState } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const PAID_SOCIAL_BACKOFF_CLEANUP_MAX_DELETE_HARD = 5000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getPaidSocialBackoffCleanupLimit(override?: number): number {
  const fromEnv = parsePositiveInt(process.env.PAID_SOCIAL_SYNC_BACKOFF_CLEANUP_LIMIT, 500);
  const base = override ?? fromEnv;
  return Math.min(Math.max(base, 1), PAID_SOCIAL_BACKOFF_CLEANUP_MAX_DELETE_HARD);
}

export type PaidSocialBackoffCleanupRun = {
  scannedCount: number;
  deletedCount: number;
  limitApplied: number;
};

/**
 * Select up to `limit` rows with expired `backoff_until`, then delete by primary key (bounded).
 */
export async function runPaidSocialSyncBackoffCleanup(db: Db, opts?: { limit?: number }): Promise<PaidSocialBackoffCleanupRun> {
  const limit = getPaidSocialBackoffCleanupLimit(opts?.limit);
  const now = new Date();

  const expired = await db
    .select({ id: paidSocialSyncBackoffState.id })
    .from(paidSocialSyncBackoffState)
    .where(and(isNotNull(paidSocialSyncBackoffState.backoffUntil), lt(paidSocialSyncBackoffState.backoffUntil, now)))
    .limit(limit);

  const ids = expired.map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return { scannedCount: 0, deletedCount: 0, limitApplied: limit };
  }

  await db.delete(paidSocialSyncBackoffState).where(inArray(paidSocialSyncBackoffState.id, ids));

  return { scannedCount: ids.length, deletedCount: ids.length, limitApplied: limit };
}
