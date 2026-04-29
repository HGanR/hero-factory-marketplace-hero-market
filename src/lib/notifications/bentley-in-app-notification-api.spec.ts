import { describe, it, expect } from "@jest/globals";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import {
  buildNotificationMessage,
  extractCampaignIdFromEventPayload,
  mapNotificationRowToApiItem,
  NOTIFICATION_API_LIMIT_DEFAULT,
  NOTIFICATION_API_LIMIT_MAX,
  NOTIFICATION_CENTER_SOURCE_TYPES,
  parseNotificationLimit,
} from "@/lib/notifications/bentley-in-app-notification-api";

describe("NOTIFICATION_CENTER_SOURCE_TYPES", () => {
  it("includes publish approval for the in-app center", () => {
    expect(NOTIFICATION_CENTER_SOURCE_TYPES).toContain("campaign_publish_approval");
  });

  it("includes scheduled compliance report deliveries", () => {
    expect(NOTIFICATION_CENTER_SOURCE_TYPES).toContain("campaign_publish_approval_report");
  });
});

describe("parseNotificationLimit", () => {
  it("defaults to 10 and clamps 1–25", () => {
    expect(parseNotificationLimit(null)).toBe(NOTIFICATION_API_LIMIT_DEFAULT);
    expect(parseNotificationLimit("1")).toBe(1);
    expect(parseNotificationLimit("25")).toBe(25);
    expect(parseNotificationLimit("999")).toBe(NOTIFICATION_API_LIMIT_MAX);
    expect(parseNotificationLimit("0")).toBe(1);
  });
});

describe("extractCampaignIdFromEventPayload", () => {
  it("reads campaignId string", () => {
    expect(extractCampaignIdFromEventPayload({ campaignId: "camp-1" })).toBe("camp-1");
  });

  it("returns empty for missing", () => {
    expect(extractCampaignIdFromEventPayload(null)).toBe("");
    expect(extractCampaignIdFromEventPayload({})).toBe("");
  });
});

describe("buildNotificationMessage", () => {
  it("prefers body over title", () => {
    expect(buildNotificationMessage("hello", "t")).toBe("hello");
  });

  it("falls back to title", () => {
    expect(buildNotificationMessage("", "Title")).toBe("Title");
  });
});

describe("mapNotificationRowToApiItem", () => {
  it("maps row with readAt null", () => {
    const row: typeof bentleyNotificationEvents.$inferSelect = {
      id: "e1",
      userId: "9",
      clientId: "c",
      trustId: "",
      sourceType: "campaign_reviewer_assignment",
      eventType: "campaign_reviewer_added",
      severity: "info",
      title: "T",
      body: "Body text",
      eventPayloadJson: { campaignId: "camp-x" },
      dedupeKey: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      readAt: null,
    };
    const m = mapNotificationRowToApiItem(row);
    expect(m).toMatchObject({
      id: "e1",
      sourceType: "campaign_reviewer_assignment",
      campaignId: "camp-x",
      message: "Body text",
      readAt: null,
    });
    expect(m.createdAt).toContain("2026-01-01");
  });
});
