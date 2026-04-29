import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { CampaignPostRow } from "@/lib/db/schema";
import { buildSocialPostAnalyticsPublic, plannerAnalyticsHint } from "@/lib/social/governed-post-analytics-public";
import { SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION } from "@/lib/social/governed-post-analytics-types";

jest.mock("@/lib/social/governed-post-analytics-store", () => ({
  listRecentSnapshotsForPost: jest.fn(),
}));

const { listRecentSnapshotsForPost } = jest.requireMock("@/lib/social/governed-post-analytics-store") as {
  listRecentSnapshotsForPost: jest.Mock;
};

function post(partial: Partial<CampaignPostRow>): CampaignPostRow {
  return {
    id: "p1",
    campaignId: "c1",
    assetId: null,
    platform: "linkedin",
    scheduledAt: null,
    status: "POSTED",
    caption: "Hi",
    hashtags: null,
    linkUrl: null,
    utmParams: {},
    scheduledPublishMeta: null,
    platformPostId: "urn:li:ugcPost:1",
    errorMessage: null,
    socialAccountId: "a1",
    postedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as CampaignPostRow;
}

describe("governed-post-analytics-public", () => {
  beforeEach(() => {
    listRecentSnapshotsForPost.mockReset();
  });

  it("buildSocialPostAnalyticsPublic returns not_published for drafts", async () => {
    const db = {} as Parameters<typeof buildSocialPostAnalyticsPublic>[0];
    const r = await buildSocialPostAnalyticsPublic(db, post({ status: "DRAFT" }));
    expect(r.availability.code).toBe("not_published");
    expect(r.latest).toBeNull();
    expect(listRecentSnapshotsForPost).not.toHaveBeenCalled();
  });

  it("buildSocialPostAnalyticsPublic returns never_synced when live but no rows", async () => {
    listRecentSnapshotsForPost.mockResolvedValueOnce([]);
    const db = {} as Parameters<typeof buildSocialPostAnalyticsPublic>[0];
    const r = await buildSocialPostAnalyticsPublic(db, post({ platform: "instagram", platformPostId: "999" }));
    expect(r.availability.code).toBe("never_synced");
    expect(r.metricSyncSupport).toBe("live");
    expect(r.latest).toBeNull();
  });

  it("plannerAnalyticsHint returns null for non-posted rows", () => {
    expect(
      plannerAnalyticsHint({
        post: post({ status: "SCHEDULED" }),
        latestRow: null,
      })
    ).toBeNull();
  });

  it("plannerAnalyticsHint explains unsupported Facebook metrics", () => {
    const hint = plannerAnalyticsHint({
      post: post({ platform: "facebook", platformPostId: "x" }),
      latestRow: null,
    });
    expect(hint).toContain("Facebook");
  });
});

describe("plannerAnalyticsHint with snapshot row", () => {
  it("formats line when snapshot parses", () => {
    const payload = {
      version: SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION,
      normalized: { impressions: 5, engagementsTotal: 2 },
      platformSnapshot: { platform: "instagram", capturedAt: "2026-01-01T00:00:00.000Z" },
      sourceNotes: [],
    };
    const line = plannerAnalyticsHint({
      post: post({ platform: "instagram", platformPostId: "1" }),
      latestRow: {
        metricsJson: payload,
        fetchedAt: new Date("2026-04-08T10:00:00.000Z"),
      },
    });
    expect(line).toContain("Metrics:");
    expect(line).toContain("impr");
  });
});
