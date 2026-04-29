/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import { buildEmptyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { rolloutStrategyByPreset } from "@/lib/revenue-os/rollout-strategies";
import type { PolicyRolloutPlanRow } from "@/lib/revenue-os/policy-rollout-db";
import {
  evaluateBentleyRolloutStage,
  monitorBentleyRolloutPlan,
  buildRolloutMonitoringGuidanceLines,
} from "@/lib/revenue-os/rollout-monitoring";
import { collectBentleyRolloutObservation } from "@/lib/revenue-os/rollout-observation";
import { buildRolloutMonitoringUiPayload } from "@/lib/revenue-os/rollout-monitoring-ui";
import { rolloutNotificationKindFromMonitoring } from "@/lib/revenue-os/rollout-notifications";

function minimalPlan(overrides: Partial<PolicyRolloutPlanRow> = {}): PolicyRolloutPlanRow {
  const now = new Date();
  return {
    id: "plan-1",
    userId: "u1",
    rolloutType: "blended",
    sourceScenarioId: null,
    name: "Test plan",
    scopeJson: null,
    rolloutStrategyJson: rolloutStrategyByPreset("balanced") as unknown as Record<string, unknown>,
    guardrailsJson: null,
    rollbackPlanJson: null,
    isSaved: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("rollout monitoring engine", () => {
  const overview = buildEmptyOperatorOverview("u1");

  it("evaluateBentleyRolloutStage works with no run and sparse metrics", () => {
    const r = evaluateBentleyRolloutStage({ plan: minimalPlan(), run: null, overview });
    expect(r.rolloutHealth).toBeDefined();
    expect(r.operatorNotes.some((n) => n.includes("No rollout run"))).toBe(true);
    expect(r.successProgress.length).toBeGreaterThan(0);
  });

  it("monitorBentleyRolloutPlan aliases evaluate", () => {
    const a = evaluateBentleyRolloutStage({ plan: minimalPlan(), run: null, overview });
    const b = monitorBentleyRolloutPlan({ plan: minimalPlan(), run: null, overview });
    expect(b.recommendedNextAction).toBe(a.recommendedNextAction);
  });

  it("buildRolloutMonitoringGuidanceLines returns empty when null", () => {
    expect(buildRolloutMonitoringGuidanceLines(null)).toEqual({});
  });

  it("buildRolloutMonitoringUiPayload includes controls when opts passed", () => {
    const r = evaluateBentleyRolloutStage({ plan: minimalPlan(), run: null, overview });
    const ui = buildRolloutMonitoringUiPayload(r, { planId: "p1", runId: null });
    expect(ui.health.value).toBe(r.rolloutHealth);
    expect(ui.controls?.planId).toBe("p1");
  });

  it("rolloutNotificationKindFromMonitoring maps rollback", () => {
    const r = evaluateBentleyRolloutStage({ plan: minimalPlan(), run: null, overview });
    const kind = rolloutNotificationKindFromMonitoring({
      ...r,
      recommendedNextAction: "recommend_rollback",
    });
    expect(kind).toBe("rollout_rollback_recommended");
  });
});

describe("rollout observation", () => {
  it("collectBentleyRolloutObservation returns normalized fields", () => {
    const o = collectBentleyRolloutObservation({ overview: buildEmptyOperatorOverview("u1") });
    expect(typeof o.failedPublishTotal).toBe("number");
    expect(typeof o.workspaceCount).toBe("number");
  });
});
