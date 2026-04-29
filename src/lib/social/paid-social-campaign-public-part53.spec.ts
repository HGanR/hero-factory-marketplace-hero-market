/**
 * @jest-environment node
 */
jest.mock("@/lib/social/paid-social-meta-execution-flag", () => ({
  isMetaAdsLaunchFeatureEnabled: jest.fn(),
}));

jest.mock("@/lib/social/paid-social-sync-backoff-state", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-sync-backoff-state")>(
    "@/lib/social/paid-social-sync-backoff-state"
  );
  return {
    ...actual,
    reloadPaidSyncBackoffRow: jest.fn(),
  };
});

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { CampaignPaidSocialCampaignRow } from "@/lib/db/schema";
import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import { reloadPaidSyncBackoffRow } from "@/lib/social/paid-social-sync-backoff-state";
import { projectPaidSocialCampaignPublic } from "@/lib/social/paid-social-campaigns";

const CAMP = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

function mockDb() {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue([[], []]),
  };
}

function metaRow(over: Partial<CampaignPaidSocialCampaignRow> = {}): CampaignPaidSocialCampaignRow {
  return {
    id: PID,
    campaignId: CAMP,
    provider: "meta_ads",
    internalName: "P",
    adSetName: null,
    adName: null,
    objective: "",
    draftStatus: "draft",
    budgetType: "none",
    budgetAmountMinor: null,
    currency: "USD",
    startAt: null,
    endAt: null,
    destinationUrl: null,
    ctaLabel: null,
    leadFormPlaceholder: null,
    audienceJson: null,
    placementsJson: null,
    creativeConfigJson: null,
    createdByUserId: "1",
    updatedByUserId: "1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    metaAdAccountId: "act_999",
    metaPageId: null,
    metaFacebookSocialAccountId: null,
    metaLaunchStatus: "idle",
    remoteMetaCampaignId: null,
    remoteMetaAdsetId: null,
    remoteMetaCreativeId: null,
    remoteMetaAdId: null,
    lastLaunchErrorJson: null,
    launchedAt: null,
    lastMetaSyncAt: null,
    metaRuntimeStatus: null,
    lastMetaStatusJson: null,
    lastMetaSyncErrorJson: null,
    ...over,
  };
}

describe("projectPaidSocialCampaignPublic Part 53 (cooldown + signals fields)", () => {
  beforeEach(() => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReset().mockReturnValue(true);
    jest.mocked(reloadPaidSyncBackoffRow).mockReset().mockResolvedValue(null);
  });

  it("includes inactive cooldown when flag on and no backoff row", async () => {
    const db = mockDb();
    const p = await projectPaidSocialCampaignPublic(db as never, metaRow(), CAMP);
    expect(p.syncCooldownActive).toBe(false);
    expect(p.syncCooldownUntil).toBeNull();
    expect(p.syncCooldownReason).toBeNull();
    expect(jest.mocked(reloadPaidSyncBackoffRow)).toHaveBeenCalled();
  });

  it("does not load backoff when Meta execution flag is off", async () => {
    jest.mocked(isMetaAdsLaunchFeatureEnabled).mockReturnValue(false);
    const db = mockDb();
    const p = await projectPaidSocialCampaignPublic(db as never, metaRow(), CAMP);
    expect(p.syncCooldownActive).toBe(false);
    expect(jest.mocked(reloadPaidSyncBackoffRow)).not.toHaveBeenCalled();
  });

  it("projects active cooldown from persisted backoff row", async () => {
    const until = new Date(Date.now() + 3_600_000);
    jest.mocked(reloadPaidSyncBackoffRow).mockResolvedValue({
      id: "b1",
      provider: "meta_ads",
      accountKey: "999",
      backoffUntil: until,
      lastFailureCategory: "throttled",
      consecutiveThrottleCount: 2,
      lastFailureAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const db = mockDb();
    const p = await projectPaidSocialCampaignPublic(db as never, metaRow(), CAMP);
    expect(p.syncCooldownActive).toBe(true);
    expect(p.syncCooldownReason).toBe("throttled");
    expect(p.syncCooldownUntil).toBe(until.toISOString());
    expect(p.syncCooldownLabel).toMatch(/paused/i);
    expect(p.syncCooldownHint).toMatch(/deferred|Meta|rate/i);
  });

  it("includes Part 59 projection fields when no organic reference", async () => {
    const db = mockDb();
    const p = await projectPaidSocialCampaignPublic(db as never, metaRow(), CAMP);
    expect(p.referenceCampaignPostId).toBeNull();
    expect(p.paidCreativeSource).toBe("manual");
    expect(p.crossSurfaceSignals).toEqual([]);
    expect(p.crossSurfacePromotionOutcomes).toBeUndefined();
    expect(p.crossSurfaceComparisonReadiness).toBeUndefined();
  });

  it("surfaces paidOptimizationSignals from latest metrics when launched", async () => {
    const db = mockDb();
    jest.mocked(db.limit).mockResolvedValue([
      {
        id: "snap1",
        campaignPaidSocialCampaignId: PID,
        provider: "meta_ads",
        metricsJson: {
          normalized: {
            impressions: 500,
            clicks: 1,
            spendMinor: null,
            reach: null,
            cpcMinor: null,
            cpmMinor: null,
            ctr: null,
          },
        },
        fetchedAt: new Date("2026-01-10T00:00:00.000Z"),
        createdAt: new Date("2026-01-10T00:00:00.000Z"),
      },
    ]);
    const row = metaRow({
      metaLaunchStatus: "launched",
      remoteMetaCampaignId: "c_remote",
      lastMetaSyncAt: new Date("2026-01-10T00:00:00.000Z"),
    });
    const p = await projectPaidSocialCampaignPublic(db as never, row, CAMP);
    expect(p.paidOptimizationSignals.some((s) => s.code === "low_ctr")).toBe(true);
  });

  it("Part 61: projects crossSurfacePromotionOutcomes when paid delivery beats organic (impressions)", async () => {
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = mockDb();
    jest.mocked(db.limit).mockResolvedValue([
      {
        id: "snap1",
        campaignPaidSocialCampaignId: PID,
        provider: "meta_ads",
        metricsJson: {
          normalized: {
            impressions: 3000,
            clicks: 10,
            spendMinor: null,
            reach: null,
            cpcMinor: null,
            cpmMinor: null,
            ctr: null,
          },
        },
        fetchedAt: new Date("2026-02-14T14:00:00.000Z"),
        createdAt: new Date("2026-02-14T00:00:00.000Z"),
      },
    ]);
    const row = metaRow({
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const refMap = new Map([
      [POST_REF, { impressions: 1000, engagementsTotal: 40 }],
    ]);
    const p = await projectPaidSocialCampaignPublic(db as never, row, CAMP, {
      referencePostMetricsByPostId: refMap,
      comparisonNow: new Date("2026-02-20T12:00:00.000Z"),
      referencePostSnapshotFetchedAtByPostId: new Map([[POST_REF, new Date("2026-02-14T10:00:00.000Z")]]),
      referencePostPublishedAtByPostId: new Map([[POST_REF, new Date("2025-12-01T10:00:00.000Z")]]),
    });
    expect(p.crossSurfaceComparisonReadiness).toEqual({ comparable: true });
    expect(p.crossSurfacePromotionOutcomes).toEqual({
      paidOutperformingOrganic: true,
      paidUnderperformingOrganic: false,
      promotionEffective: true,
      promotionInefficient: false,
    });
  });

  it("Part 61: projects promotionInefficient when paid impressions trail organic", async () => {
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = mockDb();
    jest.mocked(db.limit).mockResolvedValue([
      {
        id: "snap1",
        campaignPaidSocialCampaignId: PID,
        provider: "meta_ads",
        metricsJson: {
          normalized: {
            impressions: 700,
            clicks: 2,
            spendMinor: null,
            reach: null,
            cpcMinor: null,
            cpmMinor: null,
            ctr: null,
          },
        },
        fetchedAt: new Date("2026-02-14T14:00:00.000Z"),
        createdAt: new Date("2026-02-14T00:00:00.000Z"),
      },
    ]);
    const row = metaRow({
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const refMap = new Map([
      [POST_REF, { impressions: 1000, engagementsTotal: 30 }],
    ]);
    const p = await projectPaidSocialCampaignPublic(db as never, row, CAMP, {
      referencePostMetricsByPostId: refMap,
      comparisonNow: new Date("2026-02-20T12:00:00.000Z"),
      referencePostSnapshotFetchedAtByPostId: new Map([[POST_REF, new Date("2026-02-14T10:00:00.000Z")]]),
      referencePostPublishedAtByPostId: new Map([[POST_REF, new Date("2025-12-01T10:00:00.000Z")]]),
    });
    expect(p.crossSurfaceComparisonReadiness).toEqual({ comparable: true });
    expect(p.crossSurfacePromotionOutcomes).toEqual({
      paidOutperformingOrganic: false,
      paidUnderperformingOrganic: true,
      promotionEffective: false,
      promotionInefficient: true,
    });
  });

  it("Part 62: omits promotion outcomes when snapshots are not aligned; emits readiness", async () => {
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = mockDb();
    jest.mocked(db.limit).mockResolvedValue([
      {
        id: "snap1",
        campaignPaidSocialCampaignId: PID,
        provider: "meta_ads",
        metricsJson: {
          normalized: {
            impressions: 3000,
            clicks: 10,
            spendMinor: null,
            reach: null,
            cpcMinor: null,
            cpmMinor: null,
            ctr: null,
          },
        },
        fetchedAt: new Date("2026-02-10T10:00:00.000Z"),
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);
    const row = metaRow({
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const refMap = new Map([
      [POST_REF, { impressions: 1000, engagementsTotal: 40 }],
    ]);
    const p = await projectPaidSocialCampaignPublic(db as never, row, CAMP, {
      referencePostMetricsByPostId: refMap,
      comparisonNow: new Date("2026-03-01T12:00:00.000Z"),
      referencePostSnapshotFetchedAtByPostId: new Map([[POST_REF, new Date("2026-02-01T10:00:00.000Z")]]),
      referencePostPublishedAtByPostId: new Map([[POST_REF, new Date("2025-12-01T10:00:00.000Z")]]),
    });
    expect(p.crossSurfacePromotionOutcomes).toBeUndefined();
    expect(p.crossSurfaceComparisonReadiness).toEqual({ comparable: false, reason: "stale_organic" });
  });

  it("Part 64: emits insufficient_sample and omits outcomes when samples are below floor", async () => {
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = mockDb();
    jest.mocked(db.limit).mockResolvedValue([
      {
        id: "snap1",
        campaignPaidSocialCampaignId: PID,
        provider: "meta_ads",
        metricsJson: {
          normalized: {
            impressions: 80,
            clicks: 1,
            spendMinor: null,
            reach: null,
            cpcMinor: null,
            cpmMinor: null,
            ctr: null,
          },
        },
        fetchedAt: new Date("2026-02-14T14:00:00.000Z"),
        createdAt: new Date("2026-02-14T00:00:00.000Z"),
      },
    ]);
    const row = metaRow({
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const refMap = new Map([[POST_REF, { impressions: 1000, engagementsTotal: 40 }]]);
    const p = await projectPaidSocialCampaignPublic(db as never, row, CAMP, {
      referencePostMetricsByPostId: refMap,
      comparisonNow: new Date("2026-02-20T12:00:00.000Z"),
      referencePostSnapshotFetchedAtByPostId: new Map([[POST_REF, new Date("2026-02-14T10:00:00.000Z")]]),
      referencePostPublishedAtByPostId: new Map([[POST_REF, new Date("2025-12-01T10:00:00.000Z")]]),
    });
    expect(p.crossSurfacePromotionOutcomes).toBeUndefined();
    expect(p.crossSurfaceComparisonReadiness).toEqual({ comparable: false, reason: "insufficient_sample" });
  });
});
