import { describe, it, expect, afterEach } from "@jest/globals";
import {
  buildPublishingPlannerItems,
  groupPublishingPlannerItemsByDay,
  formatPublishingPlannerStatus,
  sortPublishingPlannerItems,
  plannerDayKeyUtc,
} from "@/lib/social/publishing-planner";
import type { campaignPosts } from "@/lib/db/schema";

function row(partial: Partial<typeof campaignPosts.$inferSelect>): typeof campaignPosts.$inferSelect {
  return {
    id: "p1",
    campaignId: "c1",
    platform: "linkedin",
    assetId: null,
    scheduledAt: null,
    status: "DRAFT",
    caption: "Hello",
    hashtags: null,
    linkUrl: null,
    utmParams: {},
    scheduledPublishMeta: null,
    platformPostId: null,
    errorMessage: null,
    socialAccountId: "acc1",
    postedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as typeof campaignPosts.$inferSelect;
}

describe("publishing-planner", () => {
  const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;

  afterEach(() => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
  });

  it("marks Social Studio lineage from UTM", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const direct = buildPublishingPlannerItems({
      rows: [row({ utmParams: { from_social_studio: "1" } })],
      socialAccountDisplayById: {},
    });
    expect(direct[0].fromSocialStudio).toBe(true);
    const legacy = buildPublishingPlannerItems({
      rows: [row({ utmParams: { social_studio_run_id: "r1" } })],
      socialAccountDisplayById: {},
    });
    expect(legacy[0].fromSocialStudio).toBe(true);
    const notStudio = buildPublishingPlannerItems({
      rows: [row({ utmParams: {} })],
      socialAccountDisplayById: {},
    });
    expect(notStudio[0].fromSocialStudio).toBe(false);
  });

  it("buildPublishingPlannerItems sets plannerDayKey from scheduledFor", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          scheduledAt: new Date("2026-06-15T14:00:00.000Z"),
          status: "SCHEDULED",
          utmParams: { bentley_approval_status: "approved" },
        }),
      ],
      socialAccountDisplayById: { acc1: "Pat" },
    });
    expect(items[0].plannerDayKey).toBe("2026-06-15");
    expect(items[0].socialAccountLabel).toBe("Pat");
  });

  it("falls back to platform display label when account map misses id", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          platform: "facebook",
          socialAccountId: "acc-fb",
          scheduledAt: new Date("2026-06-15T14:00:00.000Z"),
          status: "SCHEDULED",
        }),
      ],
      socialAccountDisplayById: {},
    });
    expect(items[0].socialAccountLabel).toBe("Facebook");
  });

  it("groupPublishingPlannerItemsByDay groups by day key", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          id: "a",
          scheduledAt: new Date("2026-06-15T10:00:00.000Z"),
          status: "SCHEDULED",
        }),
        row({
          id: "b",
          scheduledAt: new Date("2026-06-15T16:00:00.000Z"),
          status: "SCHEDULED",
        }),
      ],
      socialAccountDisplayById: {},
    });
    const groups = groupPublishingPlannerItemsByDay(items);
    expect(groups.length).toBe(1);
    expect(groups[0].items.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("sortPublishingPlannerItems orders by scheduled time", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({ id: "late", scheduledAt: new Date("2026-06-15T16:00:00.000Z"), status: "SCHEDULED" }),
        row({ id: "early", scheduledAt: new Date("2026-06-15T10:00:00.000Z"), status: "SCHEDULED" }),
      ],
      socialAccountDisplayById: {},
    });
    const sorted = sortPublishingPlannerItems(items);
    expect(sorted.map((i) => i.id)).toEqual(["early", "late"]);
  });

  it("formatPublishingPlannerStatus reflects rejected", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          status: "DRAFT",
          utmParams: { bentley_approval_status: "rejected", bentley_approval_reason: "no" },
        }),
      ],
      socialAccountDisplayById: {},
    });
    expect(formatPublishingPlannerStatus(items[0])).toBe("Rejected");
  });

  it("plannerDayKeyUtc handles unscheduled", () => {
    expect(plannerDayKeyUtc(null)).toBe("unscheduled");
  });

  it("buildPublishingPlannerItems sets observability fields", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          caption: "",
          status: "DRAFT",
          utmParams: {},
        }),
      ],
      socialAccountDisplayById: {},
    });
    expect(items[0].blockedReasonCode).toBe("missing_content");
    expect(items[0].approvalChainSummary).toBeTruthy();
    expect(items[0].operatorNextActionHint).toBeTruthy();
  });

  it("buildPublishingPlannerItems passes analyticsSummaryLine from map", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [row({ id: "p9", status: "POSTED" })],
      socialAccountDisplayById: {},
      analyticsSummaryByPostId: { p9: "Metrics: 1 impr · synced" },
    });
    expect(items[0].analyticsSummaryLine).toBe("Metrics: 1 impr · synced");
  });

  it("buildPublishingPlannerItems marks instagram TEXT asset as provider_media_incompatible", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const items = buildPublishingPlannerItems({
      rows: [
        row({
          platform: "instagram",
          assetId: "as-1",
          caption: "Hi",
          status: "DRAFT",
          utmParams: {},
        }),
      ],
      socialAccountDisplayById: {},
      creativeTypeByAssetId: { "as-1": "TEXT" },
    });
    expect(items[0].blockedReasonCode).toBe("provider_media_incompatible");
  });
});
