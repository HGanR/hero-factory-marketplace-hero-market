import {
  isStaleReviewConflictResponse,
  staleReviewRecoveryToastMessage,
  buildApprovalReviewSnapshotFromWorkflowRow,
  finalizeStaleReviewWorkflowRefresh,
} from "@/lib/revenue-os/stale-review-recovery";

describe("isStaleReviewConflictResponse", () => {
  it("is true for 409 with STALE_REVIEW error", () => {
    const body = { error: "STALE_REVIEW", message: "x", staleCause: "post_row_changed" };
    expect(isStaleReviewConflictResponse(409, body)).toBe(true);
  });

  it("is false for other status or error", () => {
    expect(isStaleReviewConflictResponse(200, { error: "STALE_REVIEW" })).toBe(false);
    expect(isStaleReviewConflictResponse(409, { error: "OTHER" })).toBe(false);
    expect(isStaleReviewConflictResponse(409, null)).toBe(false);
  });
});

describe("staleReviewRecoveryToastMessage", () => {
  it("includes server message and recovery hint when present", () => {
    expect(staleReviewRecoveryToastMessage({ message: "State changed." })).toContain("State changed.");
    expect(staleReviewRecoveryToastMessage({ message: "State changed." })).toContain("refreshed");
  });

  it("uses default when message missing", () => {
    expect(staleReviewRecoveryToastMessage({})).toContain("approval state changed");
  });
});

describe("buildApprovalReviewSnapshotFromWorkflowRow", () => {
  it("returns null without updatedAt", () => {
    expect(
      buildApprovalReviewSnapshotFromWorkflowRow({
        approvalStatus: "pending_approval",
        postRowUpdatedAt: null,
      })
    ).toBeNull();
  });

  it("returns snapshot when row has both fields", () => {
    expect(
      buildApprovalReviewSnapshotFromWorkflowRow({
        approvalStatus: "approved",
        postRowUpdatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toEqual({
      expectedApprovalStatus: "approved",
      postUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("second submit after refresh uses new updatedAt when row changes", () => {
    const before = buildApprovalReviewSnapshotFromWorkflowRow({
      approvalStatus: "pending_approval",
      postRowUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    const after = buildApprovalReviewSnapshotFromWorkflowRow({
      approvalStatus: "approved",
      postRowUpdatedAt: "2026-01-01T00:00:01.000Z",
    });
    expect(before?.postUpdatedAt).not.toBe(after?.postUpdatedAt);
    expect(after?.expectedApprovalStatus).toBe("approved");
  });
});

describe("finalizeStaleReviewWorkflowRefresh", () => {
  it("awaits refresh and returns debug summary when debug and row match", async () => {
    const refresh = jest.fn(async () => ({
      rows: [
        {
          postId: "a",
          approvalStatus: "approved" as const,
          postRowUpdatedAt: "2026-02-02T00:00:00.000Z",
        },
      ],
    }));
    const summary = await finalizeStaleReviewWorkflowRefresh({
      responseBody: { error: "STALE_REVIEW", staleCause: "approval_state_mismatch" },
      postId: "a",
      rowBefore: {
        postId: "a",
        approvalStatus: "pending_approval",
        postRowUpdatedAt: "2026-02-01T00:00:00.000Z",
      },
      refresh,
      debug: true,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(summary?.expectedApprovalStatusBefore).toBe("pending_approval");
    expect(summary?.latestApprovalStatus).toBe("approved");
    expect(summary?.postRowUpdatedAtBefore).toBe("2026-02-01T00:00:00.000Z");
    expect(summary?.postRowUpdatedAtAfter).toBe("2026-02-02T00:00:00.000Z");
  });

  it("returns null when debug is off (no snapshot diff)", async () => {
    const refresh = jest.fn(async () => ({ rows: [{ postId: "a", approvalStatus: "approved" }] }));
    const summary = await finalizeStaleReviewWorkflowRefresh({
      responseBody: { error: "STALE_REVIEW" },
      postId: "a",
      rowBefore: { postId: "a", approvalStatus: "pending_approval", postRowUpdatedAt: "t0" },
      refresh,
      debug: false,
    });
    expect(refresh).toHaveBeenCalled();
    expect(summary).toBeNull();
  });

  it("second logical submit can use refreshed snapshot (row fields updated after refresh)", async () => {
    const rowAfterRefresh = {
      postId: "p",
      approvalStatus: "approved" as const,
      postRowUpdatedAt: "2026-01-10T00:00:01.000Z",
    };
    const snap = buildApprovalReviewSnapshotFromWorkflowRow(rowAfterRefresh);
    expect(snap?.expectedApprovalStatus).toBe("approved");
    expect(snap?.postUpdatedAt).toBe("2026-01-10T00:00:01.000Z");
  });
});
