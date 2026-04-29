/**
 * @jest-environment node
 */

import { summarizeBentleyPolicyChangeSet } from "@/lib/revenue-os/policy-change-sets";

describe("summarizeBentleyPolicyChangeSet", () => {
  it("describes applicable counts and families", () => {
    const s = summarizeBentleyPolicyChangeSet({
      name: "Test",
      changeSetType: "forward_deploy",
      deploymentSummary: {
        totalItems: 3,
        applicableItems: 2,
        skippedItems: 1,
        families: ["notifications", "automation"],
      },
    });
    expect(s).toContain("forward_deploy");
    expect(s).toContain("2/3");
    expect(s).toContain("notifications");
  });
});
