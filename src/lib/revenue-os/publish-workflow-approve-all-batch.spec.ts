import {
  executeApproveAllBatch,
  formatApproveAllBatchPersistentSummary,
  formatApproveAllBatchUserMessage,
  rowBulkApproveHighlightKind,
  type ApproveAllPatchRowFn,
  type ApproveAllBatchResult,
} from "@/lib/revenue-os/publish-workflow-approve-all-batch";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

function row(id: string): RevenueOsPublishWorkflowRow {
  return {
    postId: id,
    platform: "linkedin",
    bodyPreview: "x",
    status: "scheduled",
    approvalStatus: "pending_approval",
  };
}

function batchFixture(over: Partial<ApproveAllBatchResult>): ApproveAllBatchResult {
  return {
    attemptedCount: 0,
    succeededCount: 0,
    idempotentCount: 0,
    staleStoppedAtPostId: null,
    remainingCount: 0,
    freshApprovedPostIds: [],
    idempotentPostIds: [],
    ...over,
  };
}

describe("executeApproveAllBatch", () => {
  it("counts fresh vs idempotent and preserves deterministic order", async () => {
    const order: string[] = [];
    const patch: ApproveAllPatchRowFn = async (r) => {
      order.push(r.postId);
      if (r.postId === "b") return { staleRecovered: false, idempotent: true };
      return { staleRecovered: false, idempotent: false };
    };
    const batch = await executeApproveAllBatch([row("a"), row("b"), row("c")], patch);
    expect(order).toEqual(["a", "b", "c"]);
    expect(batch).toEqual({
      attemptedCount: 3,
      succeededCount: 2,
      idempotentCount: 1,
      staleStoppedAtPostId: null,
      remainingCount: 0,
      freshApprovedPostIds: ["a", "c"],
      idempotentPostIds: ["b"],
    });
  });

  it("stops on first stale with partial success and remainingCount", async () => {
    const patch: ApproveAllPatchRowFn = async (r) => {
      if (r.postId === "p2") return { staleRecovered: true };
      return { staleRecovered: false, idempotent: false };
    };
    const batch = await executeApproveAllBatch([row("p1"), row("p2"), row("p3")], patch);
    expect(batch.staleStoppedAtPostId).toBe("p2");
    expect(batch.succeededCount).toBe(1);
    expect(batch.attemptedCount).toBe(2);
    expect(batch.remainingCount).toBe(1);
    expect(batch.freshApprovedPostIds).toEqual(["p1"]);
    expect(batch.idempotentPostIds).toEqual([]);
  });

  it("resume after stale: second batch completes remaining rows in order", async () => {
    const firstRun: ApproveAllPatchRowFn = async (r) => {
      if (r.postId === "a") return { staleRecovered: false, idempotent: true };
      if (r.postId === "b") return { staleRecovered: true };
      return { staleRecovered: false, idempotent: false };
    };
    const b1 = await executeApproveAllBatch([row("a"), row("b"), row("c")], firstRun);
    expect(b1.idempotentPostIds).toEqual(["a"]);
    expect(b1.freshApprovedPostIds).toEqual([]);
    expect(b1.staleStoppedAtPostId).toBe("b");
    const secondRun: ApproveAllPatchRowFn = async () => ({ staleRecovered: false, idempotent: false });
    const b2 = await executeApproveAllBatch([row("b"), row("c")], secondRun);
    expect(b2.freshApprovedPostIds).toEqual(["b", "c"]);
    expect(b2.succeededCount).toBe(2);
  });

  it("idempotent rows do not stop the batch", async () => {
    const patch: ApproveAllPatchRowFn = async () => ({ staleRecovered: false, idempotent: true });
    const batch = await executeApproveAllBatch([row("x"), row("y")], patch);
    expect(batch.idempotentPostIds).toEqual(["x", "y"]);
    expect(batch.freshApprovedPostIds).toEqual([]);
  });
});

describe("formatApproveAllBatchUserMessage", () => {
  it("full success with fresh only", () => {
    const m = formatApproveAllBatchUserMessage(
      batchFixture({ attemptedCount: 2, succeededCount: 2 })
    );
    expect(m.variant).toBe("success");
    expect(m.text).toContain("2 row");
  });

  it("stale partial lists counts and rerun hint", () => {
    const m = formatApproveAllBatchUserMessage(
      batchFixture({
        attemptedCount: 2,
        succeededCount: 1,
        staleStoppedAtPostId: "x",
        remainingCount: 1,
      })
    );
    expect(m.variant).toBe("message");
    expect(m.text).toContain("1 post(s)");
    expect(m.text).toContain("Approve all again");
  });

  it("full batch all idempotent uses success variant", () => {
    const m = formatApproveAllBatchUserMessage(
      batchFixture({
        attemptedCount: 3,
        idempotentCount: 3,
      })
    );
    expect(m.variant).toBe("success");
    expect(m.text).toContain("already approved");
  });
});

describe("formatApproveAllBatchPersistentSummary", () => {
  it("describes full success", () => {
    const s = formatApproveAllBatchPersistentSummary(
      batchFixture({
        attemptedCount: 2,
        succeededCount: 2,
        freshApprovedPostIds: ["a", "b"],
      })
    );
    expect(s).toContain("Last bulk approve");
    expect(s).toContain("2 newly approved");
  });

  it("includes idempotent when nonzero", () => {
    const s = formatApproveAllBatchPersistentSummary(
      batchFixture({
        attemptedCount: 2,
        succeededCount: 1,
        idempotentCount: 1,
        freshApprovedPostIds: ["a"],
        idempotentPostIds: ["b"],
      })
    );
    expect(s).toContain("already approved");
  });

  it("shows stale stop and remaining", () => {
    const s = formatApproveAllBatchPersistentSummary(
      batchFixture({
        attemptedCount: 2,
        succeededCount: 1,
        staleStoppedAtPostId: "stale-id",
        remainingCount: 1,
        freshApprovedPostIds: ["a"],
      })
    );
    expect(s).toContain("out of date");
    expect(s).toContain("not processed");
  });
});

describe("rowBulkApproveHighlightKind", () => {
  const hl = { freshApprovedPostIds: ["a", "c"], idempotentPostIds: ["b"] };

  it("matches fresh and idempotent membership from batch ids", () => {
    expect(rowBulkApproveHighlightKind("a", hl)).toBe("fresh");
    expect(rowBulkApproveHighlightKind("b", hl)).toBe("idempotent");
    expect(rowBulkApproveHighlightKind("c", hl)).toBe("fresh");
    expect(rowBulkApproveHighlightKind("z", hl)).toBeNull();
  });

  it("fresh wins if post id were in both lists (should not happen)", () => {
    expect(
      rowBulkApproveHighlightKind("x", { freshApprovedPostIds: ["x"], idempotentPostIds: ["x"] })
    ).toBe("fresh");
  });
});
