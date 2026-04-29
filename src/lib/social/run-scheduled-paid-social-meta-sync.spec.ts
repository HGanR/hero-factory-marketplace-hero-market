/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

jest.mock("@/lib/social/paid-social-meta-execution-flag", () => ({
  isMetaAdsLaunchFeatureEnabled: jest.fn(),
}));
jest.mock("@/lib/social/paid-social-campaign-meta-sync", () => ({
  syncPaidSocialMetaCampaign: jest.fn(),
}));
jest.mock("@/lib/social/paid-social-sync-backoff-state", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-sync-backoff-state")>(
    "@/lib/social/paid-social-sync-backoff-state"
  );
  return {
    ...actual,
    loadPaidSyncBackoffStatesForAccounts: jest.fn().mockResolvedValue(new Map()),
    applyPaidMetaSyncAttemptToBackoffState: jest.fn().mockResolvedValue(undefined),
    reloadPaidSyncBackoffRow: jest.fn().mockResolvedValue(null),
  };
});

import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import { syncPaidSocialMetaCampaign } from "@/lib/social/paid-social-campaign-meta-sync";
import { loadPaidSyncBackoffStatesForAccounts } from "@/lib/social/paid-social-sync-backoff-state";
import { runScheduledPaidSocialMetaSync } from "@/lib/social/run-scheduled-paid-social-meta-sync";

const okSync = {
  ok: true,
  paidCampaign: {} as never,
  sync: {
    snapshotInserted: false,
    runtimeStatus: "active",
    warningCount: 0,
    phasesWithErrors: [],
    hadThrottlePhase: false,
    hadAuthPhase: false,
    syncFailedTotally: false,
    worstHardCategory: null,
    insightsSource: "ad" as const,
    metricsCompleteness: "none" as const,
    sourceNotes: [],
    usedFallbackInsights: false,
  },
};

describe("runScheduledPaidSocialMetaSync", () => {
  const FLAG = "PAID_SOCIAL_META_ADS_EXECUTION_ENABLED";
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[FLAG];
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReset();
    jest.mocked(syncPaidSocialMetaCampaign).mockReset();
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockReset().mockResolvedValue(new Map());
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });

  it("skips when feature flag off", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(false);
    const run = await runScheduledPaidSocialMetaSync({} as never, {});
    expect(run.skipped).toBe(true);
    expect(run.successCount).toBe(0);
    expect(run.throttledCount).toBe(0);
    expect(run.deferredDueToRunBackoff).toBe(0);
    expect(syncPaidSocialMetaCampaign).not.toHaveBeenCalled();
  });

  it("syncs returned rows when flag on", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: "a", campaignId: "c", metaAdAccountId: "act_1" },
        { id: "b", campaignId: "c", metaAdAccountId: "act_1" },
      ]),
    };
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue(okSync as never);

    const run = await runScheduledPaidSocialMetaSync(db as never);
    expect(run.attempted).toBe(2);
    expect(run.succeeded).toBe(2);
    expect(run.successCount).toBe(2);
    expect(run.throttledCount).toBe(0);
    expect(run.authErrorCount).toBe(0);
    expect(run.deferredDueToRunBackoff).toBe(0);
    expect(syncPaidSocialMetaCampaign).toHaveBeenCalledTimes(2);
  });

  it("defers further rows for an account after throttle streak reaches pause threshold", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: "a", campaignId: "c1", metaAdAccountId: "act_x" },
        { id: "b", campaignId: "c2", metaAdAccountId: "act_x" },
        { id: "c", campaignId: "c3", metaAdAccountId: "act_x" },
      ]),
    };
    jest
      .mocked(syncPaidSocialMetaCampaign)
      .mockResolvedValueOnce({
        ...okSync,
        sync: { ...okSync.sync, hadThrottlePhase: true, syncFailedTotally: true },
      } as never)
      .mockResolvedValueOnce({
        ...okSync,
        sync: { ...okSync.sync, hadThrottlePhase: true, syncFailedTotally: true },
      } as never);

    const run = await runScheduledPaidSocialMetaSync(db as never, { throttlePauseAfter: 2, maxItems: 10 });
    expect(run.attempted).toBe(2);
    expect(run.deferredDueToBackoff).toBe(1);
    expect(run.deferredDueToRunBackoff).toBe(1);
    expect(run.throttledCount).toBe(2);
    expect(syncPaidSocialMetaCampaign).toHaveBeenCalledTimes(2);
  });

  it("increments authErrorCount when sync reports auth phase", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ id: "a", campaignId: "c", metaAdAccountId: "act_1" }]),
    };
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue({
      ...okSync,
      sync: { ...okSync.sync, hadAuthPhase: true },
    } as never);
    const run = await runScheduledPaidSocialMetaSync(db as never);
    expect(run.authErrorCount).toBe(1);
    expect(run.successCount).toBe(1);
  });

  it("respects maxPerAccount", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: "a", campaignId: "c", metaAdAccountId: "act_1" },
        { id: "b", campaignId: "c", metaAdAccountId: "act_1" },
        { id: "c", campaignId: "c", metaAdAccountId: "act_1" },
      ]),
    };
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue(okSync as never);

    const run = await runScheduledPaidSocialMetaSync(db as never, { maxPerAccount: 1, maxItems: 10 });
    expect(run.attempted).toBe(1);
    expect(run.deferredDueToPerAccount).toBe(2);
  });

  it("respects maxCampaigns distinct campaign ids", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: "a", campaignId: "c1", metaAdAccountId: "act_1" },
        { id: "b", campaignId: "c2", metaAdAccountId: "act_2" },
      ]),
    };
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue(okSync as never);

    const run = await runScheduledPaidSocialMetaSync(db as never, { maxCampaigns: 1, maxItems: 10 });
    expect(run.attempted).toBe(1);
    expect(run.deferredDueToMaxCampaigns).toBe(1);
  });

  it("defers without calling Meta when persisted cooldown is active for that account", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const future = new Date(Date.now() + 3_600_000);
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockResolvedValue(
      new Map([
        [
          "12345",
          {
            id: "i1",
            provider: "meta_ads",
            accountKey: "12345",
            backoffUntil: future,
            lastFailureCategory: "throttled",
            consecutiveThrottleCount: 2,
            lastFailureAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ])
    );
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ id: "a", campaignId: "c", metaAdAccountId: "act_12345" }]),
    };
    const run = await runScheduledPaidSocialMetaSync(db as never);
    expect(run.deferredDueToPersistedBackoff).toBe(1);
    expect(run.attempted).toBe(0);
    expect(syncPaidSocialMetaCampaign).not.toHaveBeenCalled();
    expect(run.accountsDeferredDueToPersistedBackoff).toContain("12345");
  });

  it("resets throttle streak after a non-throttle outcome", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(true);
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: "a", campaignId: "c", metaAdAccountId: "act_x" },
        { id: "b", campaignId: "c", metaAdAccountId: "act_x" },
        { id: "c", campaignId: "c", metaAdAccountId: "act_x" },
      ]),
    };
    jest
      .mocked(syncPaidSocialMetaCampaign)
      .mockResolvedValueOnce({
        ...okSync,
        sync: { ...okSync.sync, hadThrottlePhase: true },
      } as never)
      .mockResolvedValueOnce(okSync as never)
      .mockResolvedValueOnce({
        ...okSync,
        sync: { ...okSync.sync, hadThrottlePhase: true },
      } as never);

    const run = await runScheduledPaidSocialMetaSync(db as never, { throttlePauseAfter: 2, maxItems: 10 });
    expect(run.attempted).toBe(3);
    expect(run.deferredDueToBackoff).toBe(0);
  });
});
