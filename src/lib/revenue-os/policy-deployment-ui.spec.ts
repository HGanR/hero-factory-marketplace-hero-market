/**
 * @jest-environment node
 */

import {
  buildPartialFailureWarningPanel,
  buildDeploymentHistorySummaryBlock,
} from "@/lib/revenue-os/policy-deployment-ui";
import type { DeploymentHistorySummary } from "@/lib/revenue-os/policy-deployment-history";

describe("policy-deployment-ui", () => {
  it("buildPartialFailureWarningPanel hides when no failures", () => {
    const p = buildPartialFailureWarningPanel({ failed: 0, applied: 2, errors: [] });
    expect(p.show).toBe(false);
  });

  it("buildPartialFailureWarningPanel surfaces errors", () => {
    const p = buildPartialFailureWarningPanel({ failed: 1, applied: 1, errors: ["a: bad"] });
    expect(p.show).toBe(true);
    expect(p.lines.join(" ")).toContain("bad");
  });

  it("buildDeploymentHistorySummaryBlock joins summary lines", () => {
    const s: DeploymentHistorySummary = {
      recentSuccessful: 1,
      recentFailures: 0,
      recentPartialApplies: 0,
      recentRollbackDeploys: 0,
      lines: ["Line one.", "Line two."],
    };
    expect(buildDeploymentHistorySummaryBlock(s)).toContain("Line one.");
  });
});
