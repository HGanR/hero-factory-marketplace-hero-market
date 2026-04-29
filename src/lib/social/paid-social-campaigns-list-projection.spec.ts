/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { loadPaidSyncBackoffStatesForAccounts } from "@/lib/social/paid-social-sync-backoff-state";
import { getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds } from "@/lib/social/paid-social-analytics-store";
import { projectPaidSocialCampaignsPublicForList } from "@/lib/social/paid-social-campaigns";
import type { CampaignPaidSocialCampaignRow } from "@/lib/db/schema";

jest.mock("@/lib/social/paid-social-meta-execution-flag", () => ({
  isMetaAdsLaunchFeatureEnabled: jest.fn(() => true),
}));

jest.mock("@/lib/social/paid-social-sync-backoff-state", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-sync-backoff-state")>(
    "@/lib/social/paid-social-sync-backoff-state"
  );
  return {
    ...actual,
    loadPaidSyncBackoffStatesForAccounts: jest.fn(),
  };
});

jest.mock("@/lib/social/paid-social-analytics-store", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-analytics-store")>(
    "@/lib/social/paid-social-analytics-store"
  );
  return {
    ...actual,
    getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds: jest.fn(),
  };
});

jest.mock("@/lib/social/governed-post-analytics-store", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/governed-post-analytics-store")>(
    "@/lib/social/governed-post-analytics-store"
  );
  return {
    ...actual,
    getLatestAnalyticsSnapshotRowsForPostIds: jest.fn().mockResolvedValue(new Map()),
  };
});

const CAMP = "11111111-1111-4111-8111-111111111111";

function row(id: string, acct: string | null): CampaignPaidSocialCampaignRow {
  return {
    id,
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
    metaAdAccountId: acct,
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
  };
}

describe("projectPaidSocialCampaignsPublicForList", () => {
  beforeEach(() => {
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockReset().mockResolvedValue(new Map());
    jest
      .mocked(getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds)
      .mockReset()
      .mockImplementation(async (_db, ids: string[]) => {
        const m = new Map<string, null>();
        for (const id of ids) m.set(id, null);
        return {
          byPaidCampaignId: m,
          snapshotRowsReturned: 0,
          snapshotQueryStrategy: "mysql_row_number_latest_per_paid_campaign_id" as const,
        };
      });
  });

  it("loads backoff once for multiple drafts sharing an ad account", async () => {
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    };
    const r1 = row("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "act_55");
    const r2 = row("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "act_55");
    await projectPaidSocialCampaignsPublicForList(db as never, [r1, r2], CAMP);
    expect(loadPaidSyncBackoffStatesForAccounts).toHaveBeenCalledTimes(1);
    expect(loadPaidSyncBackoffStatesForAccounts).toHaveBeenCalledWith(db, "meta_ads", ["55"]);
    expect(getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds).toHaveBeenCalledTimes(1);
    expect(getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds).toHaveBeenCalledWith(db, [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
  });
});
