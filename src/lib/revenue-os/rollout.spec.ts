import { describe, expect, it } from "@jest/globals";
import { buildEmptyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { buildBentleyRolloutCoaching, recommendBentleyRolloutPlan, assessBentleyRolloutRisk } from "@/lib/revenue-os/rollout-coaching";
import { scoreWorkspaceForBentleyRollout } from "@/lib/revenue-os/workspace-rollout-suitability";
import {
  buildBalancedRolloutStrategy,
  buildConservativeRolloutStrategy,
  rolloutStrategyByPreset,
} from "@/lib/revenue-os/rollout-strategies";
import { simulateBentleyRolloutPlan } from "@/lib/revenue-os/rollout-simulation";
import { buildRolloutGuidanceLines, mergeRolloutGuidanceIntoGrowthGuidance } from "@/lib/revenue-os/rollout-guidance";
import { buildRolloutStageCards } from "@/lib/revenue-os/rollout-ui";
import { buildRolloutRiskSummaryCards, buildRollbackTriggerList } from "@/lib/revenue-os/rollout-risk-ui";
import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";

const emptyOverview = buildEmptyOperatorOverview("u1");

function sampleWs(partial: Partial<OperatorWorkspaceSummary> & { workspace: OperatorWorkspaceSummary["workspace"] }): OperatorWorkspaceSummary {
  return {
    queueTotal: 10,
    draftCount: 2,
    failedCount: 0,
    approvedOrScheduledCount: 4,
    publishedUnsyncedCount: 0,
    archivedCount: 0,
    blockedConnectorTargets: 0,
    promotionReadyCount: 1,
    suppressedAssetCount: 0,
    staleBacklogCount: 1,
    activeExperimentIds: [],
    openHandoffs: 1,
    handoffReadyLeads: 2,
    leadSignalTotal: 3,
    connectorPlatformsConnected: 2,
    connectorAutoPublishReady: 2,
    cadenceSummary: "ok",
    cadencePlan: null,
    lastCadenceRunAt: new Date().toISOString(),
    healthScore: 80,
    ...partial,
  };
}

describe("rollout coaching", () => {
  it("buildBentleyRolloutCoaching returns resilient guidance with no workspaces", () => {
    const c = buildBentleyRolloutCoaching({ overview: emptyOverview });
    expect(c.rolloutStages.length).toBeGreaterThan(0);
    expect(c.operatorWarnings.some((w) => w.includes("No workspaces"))).toBe(true);
    expect(c.recommendedPilotWorkspaces).toEqual([]);
  });

  it("recommendBentleyRolloutPlan aliases coaching", () => {
    expect(recommendBentleyRolloutPlan({ overview: emptyOverview }).rolloutSummary).toBe(
      buildBentleyRolloutCoaching({ overview: emptyOverview }).rolloutSummary
    );
  });

  it("assessBentleyRolloutRisk returns level", () => {
    const r = assessBentleyRolloutRisk({ overview: emptyOverview });
    expect(["low", "medium", "high"]).toContain(r.level);
  });
});

describe("workspace rollout suitability", () => {
  it("scores strong pilot when healthy", () => {
    const s = scoreWorkspaceForBentleyRollout(
      sampleWs({
        workspace: { clientId: "c1", trustId: "t1" },
        failedCount: 0,
        blockedConnectorTargets: 0,
        healthScore: 85,
      })
    );
    expect(["strong_pilot", "acceptable_pilot"]).toContain(s.band);
    expect(s.rationale.length).toBeGreaterThan(0);
  });

  it("scores avoid when failures and blocks pile up", () => {
    const s = scoreWorkspaceForBentleyRollout(
      sampleWs({
        workspace: { clientId: "c2", trustId: "t2" },
        failedCount: 6,
        blockedConnectorTargets: 5,
        healthScore: 30,
        staleBacklogCount: 20,
      })
    );
    expect(["risky_for_rollout", "avoid_for_now"]).toContain(s.band);
  });
});

describe("rollout strategy presets", () => {
  it("exports distinct conservative vs aggressive windows", () => {
    const c = buildConservativeRolloutStrategy();
    const b = buildBalancedRolloutStrategy();
    expect(c.observationWindowHours).toBeGreaterThanOrEqual(b.observationWindowHours);
    expect(rolloutStrategyByPreset("aggressive").maxWorkspacesPerStage[0]).toBeGreaterThanOrEqual(
      rolloutStrategyByPreset("pilot_first").maxWorkspacesPerStage[0]
    );
  });
});

describe("rollout simulation", () => {
  it("dryRun simulation does not throw on empty workspaces", () => {
    const sim = simulateBentleyRolloutPlan({ workspaceSummaries: [] });
    expect(sim.dryRun).toBe(true);
    expect(sim.stages.length).toBeGreaterThan(0);
  });
});

describe("rollout guidance merge", () => {
  it("mergeRolloutGuidanceIntoGrowthGuidance preserves base", () => {
    const c = buildBentleyRolloutCoaching({ overview: emptyOverview });
    const lines = buildRolloutGuidanceLines(c);
    const merged = mergeRolloutGuidanceIntoGrowthGuidance(null, lines);
    expect(merged?.bentleyRolloutSummaryLine).toBeDefined();
  });
});

describe("rollout ui builders", () => {
  it("builds cards from coaching", () => {
    const c = buildBentleyRolloutCoaching({ overview: emptyOverview });
    expect(buildRolloutStageCards(c).length).toBe(c.rolloutStages.length);
    expect(buildRolloutRiskSummaryCards(c)[0]?.id).toBe("risk_level");
    expect(buildRolloutRiskSummaryCards(c).length).toBeGreaterThan(0);
    expect(buildRollbackTriggerList(c).length).toBe(c.rollbackTriggers.length);
  });
});
