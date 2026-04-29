/**
 * @jest-environment node
 */

import {
  recommendBentleyDeploymentOrdering,
  buildBentleyStagedDeploymentPlan,
} from "@/lib/revenue-os/staged-deployment";

describe("recommendBentleyDeploymentOrdering", () => {
  it("orders notifications before automation before autonomous", () => {
    const r = recommendBentleyDeploymentOrdering({
      familiesPresent: ["autonomous", "notifications", "automation"],
    });
    expect(r.order).toEqual(["notifications", "automation", "autonomous"]);
    expect(r.orderingRationale.length).toBeGreaterThan(0);
  });

  it("supports sparse families", () => {
    const r = recommendBentleyDeploymentOrdering({ familiesPresent: ["automation"] });
    expect(r.order).toEqual(["automation"]);
  });
});

describe("buildBentleyStagedDeploymentPlan", () => {
  it("returns pilot stages when scopeMode is pilot_set", () => {
    const p = buildBentleyStagedDeploymentPlan({
      families: ["notifications", "automation"],
      scopeMode: "pilot_set",
      pilotWorkspaces: [{ clientId: "c1", trustId: "t1", label: "Pilot A" }],
    });
    expect(p.stages.length).toBe(2);
    expect(p.operatorChecklist.length).toBeGreaterThan(0);
  });
});
