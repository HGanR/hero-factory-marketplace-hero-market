/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishWorkflowApproveAllBatchDebug } from "./PublishWorkflowApproveAllBatchDebug";
import type { ApproveAllBatchResult } from "@/lib/revenue-os/publish-workflow-approve-all-batch";

describe("PublishWorkflowApproveAllBatchDebug", () => {
  it("renders placeholder when batch is null", () => {
    const html = renderToStaticMarkup(<PublishWorkflowApproveAllBatchDebug batch={null} />);
    expect(html).toContain("approve-all-batch-debug");
    expect(html).toContain("—");
  });

  it("renders summary matching batch outcome", () => {
    const batch: ApproveAllBatchResult = {
      attemptedCount: 3,
      succeededCount: 1,
      idempotentCount: 1,
      staleStoppedAtPostId: "p-stale",
      remainingCount: 1,
      freshApprovedPostIds: ["a"],
      idempotentPostIds: ["b"],
    };
    const html = renderToStaticMarkup(<PublishWorkflowApproveAllBatchDebug batch={batch} />);
    expect(html).toContain("attemptedCount: 3");
    expect(html).toContain("succeededCount: 1");
    expect(html).toContain("idempotentCount: 1");
    expect(html).toContain("p-stale");
    expect(html).toContain("remainingCount: 1");
    expect(html).toContain("freshIds: a");
    expect(html).toContain("idempotentIds: b");
  });
});
