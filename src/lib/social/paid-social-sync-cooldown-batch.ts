/**
 * Batch-load persisted Meta sync cooldown projections for many ad accounts (Part 54).
 * One `paid_social_sync_backoff_state` query via `loadPaidSyncBackoffStatesForAccounts`; maps use `projectPaidSyncCooldownFromBackoffRow` (no duplicated rules).
 */

import {
  loadPaidSyncBackoffStatesForAccounts,
  type PaidSocialSyncBackoffRow,
} from "@/lib/social/paid-social-sync-backoff-state";
import {
  projectPaidSyncCooldownFromBackoffRow,
  type PaidSyncCooldownProjection,
} from "@/lib/social/paid-social-sync-cooldown-projection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Returns a projection for every distinct `accountKey` in `accountKeys` (including inactive cooldowns).
 */
export async function loadPaidSyncCooldownProjectionsForAccountKeys(
  db: Db,
  provider: string,
  accountKeys: string[],
  now: Date = new Date()
): Promise<Map<string, PaidSyncCooldownProjection>> {
  const uniq = Array.from(new Set(accountKeys));
  const out = new Map<string, PaidSyncCooldownProjection>();
  if (uniq.length === 0) return out;

  const loaded = await loadPaidSyncBackoffStatesForAccounts(db, provider, uniq);
  for (const key of uniq) {
    const row: PaidSocialSyncBackoffRow | undefined = loaded.get(key);
    out.set(key, projectPaidSyncCooldownFromBackoffRow(row, now));
  }
  return out;
}
