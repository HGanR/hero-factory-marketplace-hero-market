/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishWorkflowStaleRecoveryDebug } from "./PublishWorkflowStaleRecoveryDebug";
import type { StaleRecoveryDebugSummary } from "@/lib/revenue-os/stale-review-recovery";

describe("PublishWorkflowStaleRecoveryDebug", () => {
  it("renders null when summary is absent", () => {
    expect(renderToStaticMarkup(<PublishWorkflowStaleRecoveryDebug summary={null} />)).toBe("");
  });

  it("renders previous vs refreshed snapshot summary", () => {
    const summary: StaleRecoveryDebugSummary = {
      postId: "p-1",
      staleCause: "post_row_changed",
      expectedApprovalStatusBefore: "pending_approval",
      postRowUpdatedAtBefore: "2026-01-01T00:00:00.000Z",
      latestApprovalStatus: "approved",
      postRowUpdatedAtAfter: "2026-01-01T00:00:05.000Z",
    };
    const html = renderToStaticMarkup(<PublishWorkflowStaleRecoveryDebug summary={summary} />);
    expect(html).toContain('data-testid="stale-recovery-debug"');
    expect(html).toContain("pending_approval");
    expect(html).toContain("approved");
    expect(html).toContain("2026-01-01T00:00:00.000Z");
    expect(html).toContain("2026-01-01T00:00:05.000Z");
    expect(html).toContain("post_row_changed");
  });
});
