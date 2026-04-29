import {
  evaluatePublishApprovalWrite,
  isDuplicateApprovalDecision,
  postUpdatedAtMatchesSnapshot,
} from "@/lib/revenue-os/publish-approval-patch-guard";
import type { ParsedPublishApprovalUtm } from "@/lib/revenue-os/publish-approval-utm";

function prev(over: Partial<ParsedPublishApprovalUtm>): ParsedPublishApprovalUtm {
  return {
    status: "pending_approval",
    approvedAt: null,
    approvedBy: null,
    approvalReason: null,
    decidedAt: null,
    decidedByUserId: null,
    actorRole: null,
    currentApprovalStepIndex: null,
    totalApprovalSteps: null,
    currentApprovalRequiredRole: null,
    approvalStepStartedAt: null,
    slaReminderSentForLogicalStep: null,
    ...over,
  };
}

describe("isDuplicateApprovalDecision", () => {
  it("detects duplicate approve when status unchanged", () => {
    expect(
      isDuplicateApprovalDecision({
        prev: prev({ status: "approved" }),
        nextStatus: "approved",
        clientReason: null,
      })
    ).toBe(true);
  });

  it("is not duplicate when transitioning", () => {
    expect(
      isDuplicateApprovalDecision({
        prev: prev({ status: "pending_approval" }),
        nextStatus: "approved",
        clientReason: null,
      })
    ).toBe(false);
  });

  it("detects duplicate reject with same reason", () => {
    expect(
      isDuplicateApprovalDecision({
        prev: prev({ status: "rejected", approvalReason: "no" }),
        nextStatus: "rejected",
        clientReason: "no",
      })
    ).toBe(true);
  });

  it("is not duplicate when reject reason changes", () => {
    expect(
      isDuplicateApprovalDecision({
        prev: prev({ status: "rejected", approvalReason: "a" }),
        nextStatus: "rejected",
        clientReason: "b",
      })
    ).toBe(false);
  });
});

describe("evaluatePublishApprovalWrite", () => {
  const t0 = "2026-01-15T12:00:00.000Z";
  const d0 = new Date(t0);

  it("returns accepted_fresh for a normal transition", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({ status: "pending_approval" }),
        clientReason: null,
        snapshot: { expectedApprovalStatus: "pending_approval", postUpdatedAt: t0 },
        postUpdatedAtServer: d0,
      })
    ).toEqual({ outcome: "accepted_fresh" });
  });

  it("returns accepted_idempotent when repeated approve (no duplicate audit)", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({ status: "approved" }),
        clientReason: null,
        snapshot: { expectedApprovalStatus: "pending_approval", postUpdatedAt: t0 },
        postUpdatedAtServer: d0,
      })
    ).toEqual({ outcome: "accepted_idempotent" });
  });

  it("duplicate idempotent wins before stale snapshot checks (retry / double-submit)", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({ status: "approved" }),
        clientReason: null,
        snapshot: { expectedApprovalStatus: "pending_approval", postUpdatedAt: t0 },
        postUpdatedAtServer: new Date("2099-01-01T00:00:00.000Z"),
      })
    ).toEqual({ outcome: "accepted_idempotent" });
  });

  it("rejects stale when approval state changed since client load", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "rejected",
        prevParsed: prev({ status: "approved" }),
        clientReason: "x",
        snapshot: { expectedApprovalStatus: "pending_approval", postUpdatedAt: t0 },
        postUpdatedAtServer: d0,
      })
    ).toEqual({ outcome: "rejected_stale", staleCause: "approval_state_mismatch" });
  });

  it("rejects stale when post row updated since client load", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({ status: "pending_approval" }),
        clientReason: null,
        snapshot: { expectedApprovalStatus: "pending_approval", postUpdatedAt: t0 },
        postUpdatedAtServer: new Date("2026-01-15T12:00:01.000Z"),
      })
    ).toEqual({ outcome: "rejected_stale", staleCause: "post_row_changed" });
  });

  it("skips stale checks when snapshot omitted (legacy clients)", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({ status: "pending_approval" }),
        clientReason: null,
        snapshot: undefined,
        postUpdatedAtServer: new Date("2026-01-15T12:00:01.000Z"),
      })
    ).toEqual({ outcome: "accepted_fresh" });
  });

  it("rejects stale when expected chain step mismatches server awaiting step", () => {
    expect(
      evaluatePublishApprovalWrite({
        nextStatus: "approved",
        prevParsed: prev({
          status: "pending_approval",
          currentApprovalStepIndex: 1,
          totalApprovalSteps: 2,
          currentApprovalRequiredRole: "approver",
        }),
        clientReason: null,
        snapshot: {
          expectedApprovalStatus: "pending_approval",
          postUpdatedAt: t0,
          expectedApprovalStepIndex: 0,
        },
        postUpdatedAtServer: d0,
        serverAwaitingChainStepIndex: 1,
      })
    ).toEqual({ outcome: "rejected_stale", staleCause: "approval_state_mismatch" });
  });
});

describe("postUpdatedAtMatchesSnapshot", () => {
  it("matches ISO to Date at same instant", () => {
    const iso = "2026-03-01T08:30:00.000Z";
    expect(postUpdatedAtMatchesSnapshot(iso, new Date(iso))).toBe(true);
  });

  it("rejects different instants", () => {
    expect(postUpdatedAtMatchesSnapshot("2026-03-01T08:30:00.000Z", new Date("2026-03-01T08:30:01.000Z"))).toBe(
      false
    );
  });
});
