import { buildVariantOptimization, rankVariantsByPerformance } from "./variantOptimization";
import type { VariantOutcomeRollup } from "./aggregateVariantOutcomes";

function rollup(partial: Partial<VariantOutcomeRollup> & Pick<VariantOutcomeRollup, "variantId" | "variantTag">): VariantOutcomeRollup {
  return {
    deploymentIds: [],
    trackedLeadCount: 0,
    bookedOrClosed: 0,
    bookedOnlyCount: 0,
    closedCount: 0,
    estimatedPipeline: 0,
    closedRevenue: 0,
    ...partial,
  };
}

describe("rankVariantsByPerformance", () => {
  it("ranks by score when sample thresholds met", () => {
    const rollups: VariantOutcomeRollup[] = [
      rollup({
        variantId: "a",
        variantTag: "A",
        trackedLeadCount: 5,
        deploymentIds: ["d1"],
        bookedOnlyCount: 2,
        closedCount: 1,
        closedRevenue: 1000,
      }),
      rollup({
        variantId: "b",
        variantTag: "B",
        trackedLeadCount: 5,
        deploymentIds: ["d2"],
        bookedOnlyCount: 1,
        closedCount: 3,
        closedRevenue: 5000,
      }),
    ];
    const ranked = rankVariantsByPerformance(rollups, { minTrackedLeads: 3, minDeployments: 1 });
    expect(ranked[0].variantId).toBe("b");
  });
});

describe("buildVariantOptimization", () => {
  it("labels winner and runner-up when eligible", () => {
    const rollups: VariantOutcomeRollup[] = [
      rollup({
        variantId: "w",
        variantTag: "A",
        trackedLeadCount: 4,
        deploymentIds: ["d1"],
        bookedOnlyCount: 2,
        closedCount: 1,
        closedRevenue: 0,
      }),
      rollup({
        variantId: "r",
        variantTag: "B",
        trackedLeadCount: 4,
        deploymentIds: ["d2"],
        bookedOnlyCount: 1,
        closedCount: 0,
        closedRevenue: 0,
      }),
    ];
    const opt = buildVariantOptimization(rollups, { minTrackedLeads: 3, minDeployments: 1 });
    expect(opt.winner?.variantId).toBe("w");
    expect(opt.runnerUp?.variantId).toBe("r");
    expect(opt.recommendations.scale.length).toBeGreaterThan(0);
  });
});
