import { describe, it, expect, jest } from "@jest/globals";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import {
  buildPublishApprovalNotificationBody,
  CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE,
  createCampaignPublishApprovalNotificationEvent,
  PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES,
  shouldNotifyCampaignOwnerForPublishApproval,
} from "@/lib/revenue-os/publish-approval-notification";

describe("shouldNotifyCampaignOwnerForPublishApproval", () => {
  it("is false when actor is owner", () => {
    expect(shouldNotifyCampaignOwnerForPublishApproval({ ownerUserId: 5, actorUserId: 5 })).toBe(false);
  });

  it("is true when collaborator acts", () => {
    expect(shouldNotifyCampaignOwnerForPublishApproval({ ownerUserId: 5, actorUserId: 9 })).toBe(true);
  });

  it("is false when actor user id missing", () => {
    expect(shouldNotifyCampaignOwnerForPublishApproval({ ownerUserId: 5, actorUserId: null })).toBe(false);
  });

  it("is true for external client review when flagged", () => {
    expect(
      shouldNotifyCampaignOwnerForPublishApproval({
        ownerUserId: 5,
        actorUserId: null,
        externalClientReview: true,
      })
    ).toBe(true);
  });
});

describe("buildPublishApprovalNotificationBody", () => {
  it("formats approval", () => {
    expect(
      buildPublishApprovalNotificationBody({
        actorLabel: "Pat",
        postId: "p1",
        campaignName: "Spring",
        decision: "approved",
      })
    ).toBe('Pat approved post p1 in campaign "Spring".');
  });

  it("formats rejection with reason snippet", () => {
    const b = buildPublishApprovalNotificationBody({
      actorLabel: "Pat",
      postId: "p1",
      campaignName: "Spring",
      decision: "rejected",
      reason: "Needs edits",
    });
    expect(b).toContain("rejected");
    expect(b).toContain("Reason: Needs edits");
  });
});

describe("createCampaignPublishApprovalNotificationEvent", () => {
  it("inserts one row for collaborator approve", async () => {
    const calls: { table: unknown; values: Record<string, unknown> }[] = [];
    const db = {
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => {
          calls.push({ table, values: v });
          return Promise.resolve();
        },
      }),
    };
    await createCampaignPublishApprovalNotificationEvent(db, {
      ownerUserId: 1,
      clientId: "c",
      campaignId: "camp",
      campaignName: "N",
      postId: "post-1",
      decision: "approved",
      actor: { userId: 2, label: "Alex", role: "publisher", identityBacked: true },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe(bentleyNotificationEvents);
    expect(calls[0]!.values.sourceType).toBe(CAMPAIGN_PUBLISH_APPROVAL_SOURCE_TYPE);
    expect(calls[0]!.values.eventType).toBe(PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.approved);
    expect(calls[0]!.values.userId).toBe("1");
    expect(String(calls[0]!.values.body)).toContain("Alex");
  });

  it("inserts rejected with warning-style event type", async () => {
    const calls: { values: Record<string, unknown> }[] = [];
    const db = {
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          calls.push({ values: v });
          return Promise.resolve();
        },
      }),
    };
    await createCampaignPublishApprovalNotificationEvent(db, {
      ownerUserId: 1,
      clientId: "c",
      campaignId: "camp",
      campaignName: "N",
      postId: "p2",
      decision: "rejected",
      actor: { userId: 3, label: "Sam", role: "publisher", identityBacked: true },
      reason: "no",
    });
    expect(calls[0]!.values.eventType).toBe(PUBLISH_APPROVAL_NOTIFICATION_EVENT_TYPES.rejected);
    expect(calls[0]!.values.severity).toBe("warning");
  });

  it("does not insert when actor is owner", async () => {
    const db = {
      insert: jest.fn(() => ({ values: jest.fn(() => Promise.resolve()) })),
    };
    await createCampaignPublishApprovalNotificationEvent(db, {
      ownerUserId: 5,
      clientId: "c",
      campaignId: "camp",
      campaignName: "N",
      postId: "p",
      decision: "approved",
      actor: { userId: 5, label: "Owner", role: "owner", identityBacked: true },
    });
    expect(db.insert).not.toHaveBeenCalled();
  });
});
