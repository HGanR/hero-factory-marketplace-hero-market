import {
  resolvePublishApprovalAuditAction,
  extractPublishApprovalAuditActorFromDetails,
  toPublishApprovalAuditRecentApiEvent,
} from "@/lib/revenue-os/publish-approval-audit";

describe("resolvePublishApprovalAuditAction", () => {
  it("maps approved and rejected", () => {
    expect(
      resolvePublishApprovalAuditAction({ nextStatus: "approved", prevStatus: "pending_approval" })
    ).toBe("publish_approval_approved");
    expect(
      resolvePublishApprovalAuditAction({ nextStatus: "rejected", prevStatus: "pending_approval" })
    ).toBe("publish_approval_rejected");
  });

  it("cleared when returning to pending from rejected", () => {
    expect(
      resolvePublishApprovalAuditAction({ nextStatus: "pending_approval", prevStatus: "rejected" })
    ).toBe("publish_approval_cleared");
  });

  it("pending when not clearing from rejected", () => {
    expect(
      resolvePublishApprovalAuditAction({ nextStatus: "pending_approval", prevStatus: "pending_approval" })
    ).toBe("publish_approval_pending");
  });

  it("treats chain intermediate advance as approved audit action", () => {
    expect(
      resolvePublishApprovalAuditAction({
        nextStatus: "pending_approval",
        prevStatus: "pending_approval",
        chainIntermediateAdvance: true,
      })
    ).toBe("publish_approval_approved");
  });
});

describe("extractPublishApprovalAuditActorFromDetails", () => {
  it("maps decidedBy* and reason fields", () => {
    expect(
      extractPublishApprovalAuditActorFromDetails({
        decidedByUserId: 42,
        decidedByLabel: "Ada",
        actorRole: "operator",
        reason: "needs edit",
      })
    ).toEqual({
      actorUserId: 42,
      actorDisplayName: "Ada",
      reviewerRole: "editor",
      rationale: "needs edit",
    });
  });

  it("prefers explicit reviewerRole in details", () => {
    expect(
      extractPublishApprovalAuditActorFromDetails({
        decidedByUserId: 1,
        reviewerRole: "approver",
        actorRole: "operator",
      }).reviewerRole
    ).toBe("approver");
  });

  it("parses numeric user id from string", () => {
    expect(extractPublishApprovalAuditActorFromDetails({ decidedByUserId: "7" })).toEqual({
      actorUserId: 7,
    });
  });

  it("returns empty for non-objects", () => {
    expect(extractPublishApprovalAuditActorFromDetails(null)).toEqual({});
    expect(extractPublishApprovalAuditActorFromDetails([])).toEqual({});
  });
});

describe("toPublishApprovalAuditRecentApiEvent", () => {
  it("merges actor fields onto the row", () => {
    const ev = toPublishApprovalAuditRecentApiEvent({
      id: "e1",
      postId: "p1",
      action: "publish_approval_approved",
      platform: "linkedin",
      details: { decidedByLabel: "Bo", decidedByUserId: 3 },
      createdAt: "2026-04-01T12:00:00.000Z",
    });
    expect(ev.actorDisplayName).toBe("Bo");
    expect(ev.actorUserId).toBe(3);
    expect(ev.createdAt).toBe("2026-04-01T12:00:00.000Z");
  });
});
