/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { BulkApproveLastSummaryLine } from "./BulkApproveLastSummaryLine";
import type { ApproveAllBatchResult } from "@/lib/revenue-os/publish-workflow-approve-all-batch";

function B(over: Partial<ApproveAllBatchResult>): ApproveAllBatchResult {
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

describe("BulkApproveLastSummaryLine", () => {
  it("renders nothing when batch is null (cleared)", () => {
    expect(renderToStaticMarkup(<BulkApproveLastSummaryLine batch={null} />)).toBe("");
  });

  it("renders summary after full batch success", () => {
    const html = renderToStaticMarkup(
      <BulkApproveLastSummaryLine
        batch={B({
          attemptedCount: 2,
          succeededCount: 2,
          freshApprovedPostIds: ["x", "y"],
        })}
      />
    );
    expect(html).toContain("bulk-approve-last-summary");
    expect(html).toContain("2 newly approved");
  });

  it("renders summary after stale-stopped batch", () => {
    const html = renderToStaticMarkup(
      <BulkApproveLastSummaryLine
        batch={B({
          attemptedCount: 2,
          succeededCount: 1,
          staleStoppedAtPostId: "p",
          remainingCount: 1,
          freshApprovedPostIds: ["a"],
        })}
      />
    );
    expect(html).toContain("out of date");
    expect(html).toContain("not processed");
  });

  it("renders idempotent-only summary when no fresh writes", () => {
    const html = renderToStaticMarkup(
      <BulkApproveLastSummaryLine
        batch={B({
          attemptedCount: 2,
          idempotentCount: 2,
          idempotentPostIds: ["u", "v"],
        })}
      />
    );
    expect(html).toContain("2 already approved");
  });

  it("clears when parent passes null after a batch (e.g. refresh / next-run start)", () => {
    const afterBatch = renderToStaticMarkup(
      <BulkApproveLastSummaryLine batch={B({ attemptedCount: 1, succeededCount: 1, freshApprovedPostIds: ["z"] })} />
    );
    expect(afterBatch).toContain("newly approved");
    expect(renderToStaticMarkup(<BulkApproveLastSummaryLine batch={null} />)).toBe("");
  });
});
