/**
 * @jest-environment node
 */

import { buildPolicyDeploymentsWorkbenchHref } from "@/lib/revenue-os/policy-deployments-navigation";

describe("buildPolicyDeploymentsWorkbenchHref", () => {
  it("builds query string for scenario and scope", () => {
    expect(buildPolicyDeploymentsWorkbenchHref({ scenarioId: "abc", clientId: "c1", trustId: "t1" })).toBe(
      "/dashboard/bentley/policy-deployments?scenarioId=abc&clientId=c1&trustId=t1"
    );
  });

  it("prefers explicit rollback package in URL composition order", () => {
    const href = buildPolicyDeploymentsWorkbenchHref({
      rollbackPackageId: "pkg-9",
      scenarioId: "sc-1",
    });
    expect(href).toContain("rollbackPackageId=pkg-9");
    expect(href).toContain("scenarioId=sc-1");
  });
});
