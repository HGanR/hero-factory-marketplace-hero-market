/**
 * @jest-environment node
 */
jest.mock("@/lib/social/paid-social-campaigns", () => ({
  listPaidSocialCampaignsByCampaign: jest.fn(),
}));
jest.mock("@/lib/social/paid-social-analytics-store", () => ({
  getLatestPaidSocialAnalyticsSnapshot: jest.fn(),
}));

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { computePaidSocialRollupForCampaign } from "@/lib/social/paid-social-campaign-paid-rollup";
import { listPaidSocialCampaignsByCampaign } from "@/lib/social/paid-social-campaigns";
import { getLatestPaidSocialAnalyticsSnapshot } from "@/lib/social/paid-social-analytics-store";

const CAMP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function draftRow(id: string, currency = "USD") {
  return {
    id,
    campaignId: CAMP,
    provider: "meta_ads",
    internalName: "x",
    currency,
  } as import("@/lib/db/schema").CampaignPaidSocialCampaignRow;
}

describe("computePaidSocialRollupForCampaign", () => {
  beforeEach(() => {
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset();
    jest.mocked(getLatestPaidSocialAnalyticsSnapshot).mockReset();
  });

  it("returns null when no drafts", async () => {
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([]);
    const r = await computePaidSocialRollupForCampaign({} as never, CAMP);
    expect(r).toBeNull();
  });

  it("sums latest snapshot metrics per draft only", async () => {
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([draftRow(P1), draftRow(P2, "EUR")]);
    jest.mocked(getLatestPaidSocialAnalyticsSnapshot).mockImplementation(async (_db, paidId) => {
      if (paidId === P1) {
        return {
          metricsJson: { normalized: { impressions: 100, clicks: 5, spendMinor: 1000 } },
        } as never;
      }
      if (paidId === P2) {
        return {
          metricsJson: { normalized: { impressions: 50, spendMinor: 200 } },
        } as never;
      }
      return null;
    });

    const r = await computePaidSocialRollupForCampaign({} as never, CAMP);
    expect(r?.paidDraftCount).toBe(2);
    expect(r?.impressions).toBe(150);
    expect(r?.clicks).toBe(5);
    expect(r?.contributors.clicks).toBe(1);
    expect(r?.contributors.impressions).toBe(2);
    expect(r?.currency).toBe("EUR");
  });
});
