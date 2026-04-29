import { describe, it, expect, jest } from "@jest/globals";
import { bentleyNotificationEvents, campaignReviewerAssignmentAuditEvents } from "@/lib/db/schema";
import {
  buildReviewerAddedBody,
  buildReviewerRoleChangedBody,
  buildReviewerRemovedBody,
  CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES,
  CAMPAIGN_REVIEWER_NOTIFICATION_SOURCE_TYPE,
  createReviewerAssignmentAuditEvent,
  mapReviewerAssignmentAuditRowToApiItem,
  parseReviewerAssignmentAuditLimit,
  recordReviewerAddedAuditAndNotify,
  recordReviewerRemovedAuditAndNotify,
  recordReviewerRoleChangedAuditAndNotify,
  REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT,
  REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MAX,
} from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";

function mockDbForInserts() {
  const calls: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        calls.push({ table, values });
        return Promise.resolve();
      },
    }),
  };
  return { db, calls };
}

describe("parseReviewerAssignmentAuditLimit", () => {
  it("defaults to 10", () => {
    expect(parseReviewerAssignmentAuditLimit(null)).toBe(REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT);
    expect(parseReviewerAssignmentAuditLimit("")).toBe(REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT);
  });

  it("clamps to 1–25", () => {
    expect(parseReviewerAssignmentAuditLimit("1")).toBe(1);
    expect(parseReviewerAssignmentAuditLimit("25")).toBe(25);
    expect(parseReviewerAssignmentAuditLimit("200")).toBe(REVIEWER_ASSIGNMENT_AUDIT_LIMIT_MAX);
    expect(parseReviewerAssignmentAuditLimit("0")).toBe(1);
  });

  it("falls back on non-numeric", () => {
    expect(parseReviewerAssignmentAuditLimit("x")).toBe(REVIEWER_ASSIGNMENT_AUDIT_LIMIT_DEFAULT);
  });
});

describe("mapReviewerAssignmentAuditRowToApiItem", () => {
  it("maps ids and ISO createdAt", () => {
    const item = mapReviewerAssignmentAuditRowToApiItem({
      id: "e1",
      campaignId: "c1",
      action: "reviewer_added",
      targetUserId: "9",
      actorUserId: "1",
      previousRole: null,
      nextRole: "approver",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
    });
    expect(item).toMatchObject({
      id: "e1",
      campaignId: "c1",
      action: "reviewer_added",
      targetUserId: 9,
      actorUserId: 1,
      previousRole: null,
      nextRole: "approver",
      createdAt: "2026-03-01T12:00:00.000Z",
    });
  });
});

describe("createReviewerAssignmentAuditEvent", () => {
  it("normalizes roles in the stored row", async () => {
    const { db, calls } = mockDbForInserts();
    await createReviewerAssignmentAuditEvent(db, {
      campaignId: "c",
      action: "reviewer_role_changed",
      targetUserId: 1,
      actorUserId: 2,
      previousRole: "publisher",
      nextRole: "approver",
    });
    const row = calls.find((c) => c.table === campaignReviewerAssignmentAuditEvents)?.values;
    expect(row?.previousRole).toBe("approver");
    expect(row?.nextRole).toBe("approver");
  });
});

describe("campaign-reviewer-assignment-audit messages", () => {
  it("buildReviewerAddedBody matches campaign + role phrasing", () => {
    expect(buildReviewerAddedBody("Campaign X", "approver")).toBe(
      'You were added as an approver to campaign "Campaign X".'
    );
    expect(buildReviewerAddedBody("Campaign X", "reviewer")).toContain("to campaign");
  });

  it("buildReviewerRoleChangedBody states new role only", () => {
    expect(buildReviewerRoleChangedBody("My Campaign", "approver")).toBe(
      'Your reviewer role for campaign "My Campaign" was changed to approver.'
    );
  });

  it("buildReviewerRemovedBody mentions prior role", () => {
    expect(buildReviewerRemovedBody("C", "reviewer")).toContain("reviewer");
  });
});

describe("recordReviewerAddedAuditAndNotify", () => {
  it("inserts exactly one audit row and one notification", async () => {
    const { db, calls } = mockDbForInserts();
    await recordReviewerAddedAuditAndNotify(db, {
      campaignId: "c1",
      campaignName: "My Camp",
      clientId: "cl1",
      targetUserId: 9,
      actorUserId: 1,
      role: "approver",
    });
    const audit = calls.filter((c) => c.table === campaignReviewerAssignmentAuditEvents);
    const notif = calls.filter((c) => c.table === bentleyNotificationEvents);
    expect(audit).toHaveLength(1);
    expect(notif).toHaveLength(1);
    expect(audit[0]!.values.action).toBe("reviewer_added");
    expect(audit[0]!.values.previousRole).toBeNull();
    expect(audit[0]!.values.nextRole).toBe("approver");
    expect(audit[0]!.values.targetUserId).toBe("9");
    expect(audit[0]!.values.actorUserId).toBe("1");
    expect(notif[0]!.values.eventType).toBe(CAMPAIGN_REVIEWER_NOTIFICATION_EVENT_TYPES.added);
    expect(notif[0]!.values.sourceType).toBe(CAMPAIGN_REVIEWER_NOTIFICATION_SOURCE_TYPE);
    expect(String(notif[0]!.values.body)).toContain("My Camp");
  });
});

describe("recordReviewerRoleChangedAuditAndNotify", () => {
  it("logs normalized previous and next roles", async () => {
    const { db, calls } = mockDbForInserts();
    await recordReviewerRoleChangedAuditAndNotify(db, {
      campaignId: "c1",
      campaignName: "Camp",
      clientId: "cl",
      targetUserId: 2,
      actorUserId: 3,
      previousRole: "editor",
      nextRole: "approver",
    });
    expect(calls.filter((c) => c.table === campaignReviewerAssignmentAuditEvents)).toHaveLength(1);
    expect(calls.filter((c) => c.table === bentleyNotificationEvents)).toHaveLength(1);
    const a = calls.find((c) => c.table === campaignReviewerAssignmentAuditEvents)!.values;
    expect(a.action).toBe("reviewer_role_changed");
    expect(a.previousRole).toBe("editor");
    expect(a.nextRole).toBe("approver");
    const n = calls.find((c) => c.table === bentleyNotificationEvents)!.values;
    expect(String(n.body)).toContain("changed to approver");
  });
});

describe("recordReviewerRemovedAuditAndNotify", () => {
  it("inserts audit and notification (remove path notifies target)", async () => {
    const { db, calls } = mockDbForInserts();
    await recordReviewerRemovedAuditAndNotify(db, {
      campaignId: "c1",
      campaignName: "Camp",
      clientId: "cl",
      targetUserId: 4,
      actorUserId: 5,
      previousRole: "approver",
    });
    expect(calls.filter((c) => c.table === campaignReviewerAssignmentAuditEvents)).toHaveLength(1);
    expect(calls.filter((c) => c.table === bentleyNotificationEvents)).toHaveLength(1);
    const a = calls.find((c) => c.table === campaignReviewerAssignmentAuditEvents)!.values;
    expect(a.action).toBe("reviewer_removed");
    expect(a.nextRole).toBeNull();
  });
});

describe("no duplicate audit per record call", () => {
  it("single recordReviewerAddedAuditAndNotify does not double-insert audit", async () => {
    const { db, calls } = mockDbForInserts();
    await recordReviewerAddedAuditAndNotify(db, {
      campaignId: "c",
      campaignName: "N",
      clientId: "x",
      targetUserId: 1,
      actorUserId: 2,
      role: "reviewer",
    });
    expect(calls.filter((c) => c.table === campaignReviewerAssignmentAuditEvents)).toHaveLength(1);
  });
});

describe("PATCH route no-op guard (normalized roles)", () => {
  it("does not treat legacy publisher vs approver as a change", () => {
    expect(normalizeReviewerRole("publisher")).toBe(normalizeReviewerRole("approver"));
  });
});
