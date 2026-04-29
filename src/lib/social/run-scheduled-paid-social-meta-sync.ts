/**
 * Bounded scheduled Meta sync for launched paid drafts (Parts 50–53).
 * Pool scan, per-account caps, within-run throttle streak + pause, persisted account cooldown, and job metrics.
 */

import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { campaignPaidSocialCampaigns } from "@/lib/db/schema";
import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import { syncPaidSocialMetaCampaign } from "@/lib/social/paid-social-campaign-meta-sync";
import {
  applyPaidMetaSyncAttemptToBackoffState,
  loadPaidSyncBackoffStatesForAccounts,
  normalizePaidSyncAccountKey,
  PAID_SYNC_PROVIDER_META_ADS,
  reloadPaidSyncBackoffRow,
  isAccountInPersistedCooldown,
  type PaidSocialSyncBackoffRow,
} from "@/lib/social/paid-social-sync-backoff-state";
import {
  getScheduledPaidMetaSyncConfig,
  SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD,
  SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD,
  type ScheduledPaidMetaSyncConfig,
} from "@/lib/social/paid-social-scheduled-meta-sync-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** @deprecated use SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD */
export const SCHEDULED_PAID_META_SYNC_MAX_PER_RUN_HARD = SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD;

export const SCHEDULED_PAID_META_SYNC_DEFAULT = 15;

export type ScheduledPaidMetaSyncRun = {
  skipped: boolean;
  reason?: string;
  poolScanned: number;
  attempted: number;
  succeeded: number;
  failed: number;
  /** Alias for `succeeded` (Part 53 job metrics). */
  successCount: number;
  /** Attempts where Meta classified throttle on the sync bundle (Part 53). */
  throttledCount: number;
  /** Attempts where auth/token issues appeared on the sync bundle (Part 53). */
  authErrorCount: number;
  /** Within-run pause after consecutive throttled outcomes (same as Part 51). */
  deferredDueToBackoff: number;
  /** Alias for `deferredDueToBackoff` (Part 53). */
  deferredDueToRunBackoff: number;
  /** Cross-run DB-backed cooldown for this ad account (Part 52). */
  deferredDueToPersistedBackoff: number;
  /** Sample of account keys skipped for persisted cooldown (capped). */
  accountsDeferredDueToPersistedBackoff: string[];
  deferredDueToPerAccount: number;
  deferredDueToMaxCampaigns: number;
  errors: string[];
  configApplied: ScheduledPaidMetaSyncConfig;
};

export async function runScheduledPaidSocialMetaSync(
  db: Db,
  opts?: Partial<ScheduledPaidMetaSyncConfig> & { maxPerRun?: number }
): Promise<ScheduledPaidMetaSyncRun> {
  if (!isMetaAdsLaunchFeatureEnabled()) {
    return {
      skipped: true,
      reason: "PAID_SOCIAL_META_ADS_EXECUTION_ENABLED off",
      poolScanned: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      successCount: 0,
      throttledCount: 0,
      authErrorCount: 0,
      deferredDueToBackoff: 0,
      deferredDueToRunBackoff: 0,
      deferredDueToPersistedBackoff: 0,
      accountsDeferredDueToPersistedBackoff: [],
      deferredDueToPerAccount: 0,
      deferredDueToMaxCampaigns: 0,
      errors: [],
      configApplied: getScheduledPaidMetaSyncConfig(),
    };
  }

  const cfg = getScheduledPaidMetaSyncConfig({
    maxItems: opts?.maxItems ?? opts?.maxPerRun,
    scanPoolLimit: opts?.scanPoolLimit,
    maxPerAccount: opts?.maxPerAccount,
    maxCampaigns: opts?.maxCampaigns,
    throttlePauseAfter: opts?.throttlePauseAfter,
  });

  const rows = await db
    .select({
      id: campaignPaidSocialCampaigns.id,
      campaignId: campaignPaidSocialCampaigns.campaignId,
      metaAdAccountId: campaignPaidSocialCampaigns.metaAdAccountId,
    })
    .from(campaignPaidSocialCampaigns)
    .where(
      and(
        eq(campaignPaidSocialCampaigns.provider, "meta_ads"),
        eq(campaignPaidSocialCampaigns.metaLaunchStatus, "launched"),
        or(
          isNotNull(campaignPaidSocialCampaigns.remoteMetaCampaignId),
          isNotNull(campaignPaidSocialCampaigns.remoteMetaAdId)
        )
      )
    )
    .orderBy(asc(campaignPaidSocialCampaigns.lastMetaSyncAt))
    .limit(Math.min(cfg.scanPoolLimit, SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD));

  const poolScanned = rows.length;
  const now = new Date();
  const accountKeys = rows.map((r) => normalizePaidSyncAccountKey(r.metaAdAccountId));
  let backoffByAccount = await loadPaidSyncBackoffStatesForAccounts(db, PAID_SYNC_PROVIDER_META_ADS, accountKeys);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let deferredDueToBackoff = 0;
  let deferredDueToPersistedBackoff = 0;
  const accountsDeferredDueToPersistedBackoff: string[] = [];
  let deferredDueToPerAccount = 0;
  let deferredDueToMaxCampaigns = 0;
  let throttledCount = 0;
  let authErrorCount = 0;
  const errors: string[] = [];

  const throttleStreakByAccount = new Map<string, number>();
  const pausedAccounts = new Set<string>();
  const perAccountAttempts = new Map<string, number>();
  const touchedCampaigns = new Set<string>();

  function pushPersistedDeferredSample(acct: string) {
    if (accountsDeferredDueToPersistedBackoff.length >= 24) return;
    if (!accountsDeferredDueToPersistedBackoff.includes(acct)) {
      accountsDeferredDueToPersistedBackoff.push(acct);
    }
  }

  for (const r of rows) {
    if (attempted >= cfg.maxItems) break;

    const acct = normalizePaidSyncAccountKey(r.metaAdAccountId);
    const persistedRow: PaidSocialSyncBackoffRow | undefined = backoffByAccount.get(acct);
    if (isAccountInPersistedCooldown(persistedRow, now)) {
      deferredDueToPersistedBackoff += 1;
      pushPersistedDeferredSample(acct);
      continue;
    }

    if (pausedAccounts.has(acct)) {
      deferredDueToBackoff += 1;
      continue;
    }
    if ((perAccountAttempts.get(acct) ?? 0) >= cfg.maxPerAccount) {
      deferredDueToPerAccount += 1;
      continue;
    }
    if (!touchedCampaigns.has(r.campaignId) && touchedCampaigns.size >= cfg.maxCampaigns) {
      deferredDueToMaxCampaigns += 1;
      continue;
    }

    attempted += 1;
    perAccountAttempts.set(acct, (perAccountAttempts.get(acct) ?? 0) + 1);
    touchedCampaigns.add(r.campaignId);

    try {
      const out = await syncPaidSocialMetaCampaign(db, {
        paidCampaignId: r.id,
        campaignId: r.campaignId,
        userId: 0,
        skipAudit: true,
      });

      await applyPaidMetaSyncAttemptToBackoffState(db, {
        provider: PAID_SYNC_PROVIDER_META_ADS,
        accountKey: acct,
        previousRow: persistedRow,
        sync: out.sync,
      });
      const fresh = await reloadPaidSyncBackoffRow(db, PAID_SYNC_PROVIDER_META_ADS, acct);
      if (fresh) backoffByAccount.set(acct, fresh);
      else backoffByAccount.delete(acct);

      if (out.sync.hadThrottlePhase) {
        const s = (throttleStreakByAccount.get(acct) ?? 0) + 1;
        throttleStreakByAccount.set(acct, s);
        if (s >= cfg.throttlePauseAfter) {
          pausedAccounts.add(acct);
        }
      } else {
        throttleStreakByAccount.set(acct, 0);
      }

      if (out.sync.hadThrottlePhase) {
        throttledCount += 1;
      }
      if (out.sync.hadAuthPhase) {
        authErrorCount += 1;
      }

      if (out.sync.syncFailedTotally) {
        failed += 1;
      } else {
        succeeded += 1;
      }
    } catch (e) {
      failed += 1;
      errors.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    skipped: false,
    poolScanned,
    attempted,
    succeeded,
    failed,
    successCount: succeeded,
    throttledCount,
    authErrorCount,
    deferredDueToBackoff,
    deferredDueToRunBackoff: deferredDueToBackoff,
    deferredDueToPersistedBackoff,
    accountsDeferredDueToPersistedBackoff,
    deferredDueToPerAccount,
    deferredDueToMaxCampaigns,
    errors: errors.slice(0, 20),
    configApplied: cfg,
  };
}
