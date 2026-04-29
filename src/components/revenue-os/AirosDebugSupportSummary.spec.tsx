/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { AirosDebugSupportSummary } from "./AirosDebugSupportSummary";

describe("AirosDebugSupportSummary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, runs: [{ id: "a", jobType: "t" }] }),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders support block and fetches job runs", async () => {
    await act(async () => {
      root.render(
        <AirosDebugSupportSummary
          campaignId="camp-1"
          workerEnvApproval
          uiApprovalMode={false}
          viewerCampaignReviewerRole="owner"
          viewerMayFinalizePublishApproval
          viewerCanManageReviewerAssignments
          viewerCanViewApprovalAnalytics
          chainExplicitConfigured
          chainStepCount={2}
          reportScheduleEnabled
          refreshNonce={0}
          governancePlanTierLabel="standard"
          governanceEntitlements={{
            reviewerAssignmentsEnabled: true,
            multiStepApprovalChainsEnabled: false,
            approvalAnalyticsEnabled: true,
            scheduledReportDeliveryEnabled: true,
            complianceReportExportEnabled: true,
          }}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="airos-debug-support-summary"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="debug-support-campaign-id"]')?.textContent).toContain("camp-1");
    expect(container.querySelector('[data-testid="debug-support-governance-tier"]')?.textContent).toContain("standard");
    expect(container.querySelector('[data-testid="debug-support-governance-entitlements"]')?.textContent).toContain(
      "multiStep=off"
    );
    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      "/api/internal/job-runs/recent?limit=5",
      expect.objectContaining({ credentials: "include" })
    );
  });
});
