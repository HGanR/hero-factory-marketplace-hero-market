import { compareBentleyScenarios, rankBentleyScenarios } from "@/lib/revenue-os/scenario-compare";
import { buildRichScenarioCompareMatrixPayload } from "@/lib/revenue-os/scenario-compare-ui";
import {
  buildGuidedScenarioPairs,
  recommendMeaningfulScenarioPair,
  validateScenarioPairUsefulness,
} from "@/lib/revenue-os/policy-workbench-guided";
import {
  applyWorkbenchPresetToForm,
  WORKBENCH_PRESET_IDS,
  buildProposedSnapshotFromPreset,
} from "@/lib/revenue-os/policy-workbench-presets";
import { generateBentleyPolicyRecommendations } from "@/lib/revenue-os/policy-recommendations";
import {
  runBentleyPolicyScenario,
  recommendBentleyPolicyAdjustment,
  type BentleyPolicyScenarioRunResult,
} from "@/lib/revenue-os/policy-tuning-workbench";
import { compareBentleySimulationAgainstCurrent } from "@/lib/revenue-os/simulation-comparator";
import {
  buildProposedPolicySnapshotFromForm,
  buildAutonomousPatchFromForm,
  defaultPolicyWorkbenchFormState,
} from "@/lib/revenue-os/policy-workbench-form";
import {
  buildAutomationUpsertPayloadFromCadenceForm,
  buildCadenceApplyReviewPayload,
  buildNotificationPolicyUpsertPayloadFromForm,
  buildNotificationApplyReviewPayload,
} from "@/lib/revenue-os/policy-workbench-ui";
import type { AutomationPolicyRow } from "@/lib/revenue-os/automation-policies-db";
import type { NotificationPolicyRow } from "@/lib/revenue-os/notification-db";

describe("policy workbench scenario compare", () => {
  it("ranks scenarios with sparse comparison json", () => {
    const r = compareBentleyScenarios({
      scenarios: [
        { id: "a", name: "A", comparisonJson: null, riskSummaryJson: null },
        {
          id: "b",
          name: "B",
          comparisonJson: {
            addedAutoActions: 2,
            removedAutoActions: 0,
            addedApprovals: 0,
            removedApprovals: 1,
            changedNotifications: null,
            changedQueueStates: null,
            summaryDelta: "test",
          },
          riskSummaryJson: { riskFlags: ["x"] },
        },
      ],
    });
    expect(r.rankedScenarios.length).toBe(2);
    expect(r.safestScenario).toBeTruthy();
    expect(r.highestUpsideScenario).toBeTruthy();
    expect(r.balancedRecommendation.scenarioId).toBeTruthy();
  });

  it("rankBentleyScenarios aliases compare", () => {
    const r = rankBentleyScenarios({ scenarios: [{ id: "x", comparisonJson: {} }] });
    expect(r.comparisonMatrix.length).toBe(1);
  });

  it("richRows includes highlights and matrix payload is sparse-safe", () => {
    const r = compareBentleyScenarios({
      scenarios: [
        { id: "a", name: "A", comparisonJson: { addedApprovals: 2, removedApprovals: 0 }, riskSummaryJson: null },
        {
          id: "b",
          name: "B",
          comparisonJson: { addedApprovals: 0, removedApprovals: 3, handoffVolumeDelta: 5 },
          riskSummaryJson: { riskFlags: ["x", "y"] },
        },
      ],
    });
    expect(r.richRows.length).toBe(2);
    expect(r.richRows[0]?.highlights.addedApprovals).toBeDefined();
    const ui = buildRichScenarioCompareMatrixPayload(r);
    expect(ui.rows.length).toBe(2);
    expect(ui.rows[0]?.recommendationNote).toBeTruthy();
    expect(ui.badges.safest.scenarioId).toBeTruthy();
  });

  it("single scenario yields neutral highlights", () => {
    const r = compareBentleyScenarios({
      scenarios: [{ id: "only", name: "Only", comparisonJson: { addedAutoActions: 5 } }],
    });
    expect(r.richRows[0]?.highlights.addedAutoActions).toBe("neutral");
  });
});

describe("policy workbench form state", () => {
  it("builds proposed snapshot with cadence and notifications", () => {
    const f = defaultPolicyWorkbenchFormState();
    f.staleDaysProposed = "21";
    f.minSeverityProposed = "critical";
    const s = buildProposedPolicySnapshotFromForm(f);
    expect((s.cadence as { staleDaysProposed?: number }).staleDaysProposed).toBe(21);
    expect((s.notifications as { minSeverityProposed?: string }).minSeverityProposed).toBe("critical");
  });

  it("includes autonomous patch when enabled", () => {
    const f = defaultPolicyWorkbenchFormState();
    f.includeAutonomousPatch = true;
    f.autonomousPolicyId = "p1";
    f.patchRequiresApprovalAboveSeverity = "warning";
    const s = buildProposedPolicySnapshotFromForm(f);
    const auto = s.autonomous as { policyPatchesById?: Record<string, unknown> };
    expect(auto.policyPatchesById?.p1).toBeTruthy();
    const patch = buildAutonomousPatchFromForm(f);
    expect(patch?.requiresApprovalAboveSeverity).toBe("warning");
  });
});

describe("guided paired simulations", () => {
  it("buildGuidedScenarioPairs returns distinct proposals", () => {
    const pairs = buildGuidedScenarioPairs({ form: defaultPolicyWorkbenchFormState() });
    expect(pairs.length).toBeGreaterThan(0);
    const left = JSON.stringify(pairs[0]!.left.proposedPolicySnapshotJson);
    const right = JSON.stringify(pairs[0]!.right.proposedPolicySnapshotJson);
    expect(left).not.toBe(right);
  });

  it("validateScenarioPairUsefulness rejects weak pairs", () => {
    expect(validateScenarioPairUsefulness({ leftComparison: null, rightComparison: null }).meaningful).toBe(false);
    expect(
      validateScenarioPairUsefulness({
        leftComparison: { addedAutoActions: 1 },
        rightComparison: { addedAutoActions: 1 },
      }).meaningful
    ).toBe(false);
    expect(
      validateScenarioPairUsefulness({
        leftComparison: { addedAutoActions: 1 },
        rightComparison: { addedAutoActions: 2 },
      }).meaningful
    ).toBe(true);
  });

  it("recommendMeaningfulScenarioPair when flat", () => {
    const rec = recommendMeaningfulScenarioPair({ comparisonHadMaterialDelta: false });
    expect(rec?.pairId).toBe("current_vs_balanced");
  });
});

describe("workbench recommendation presets", () => {
  it("maps preset ids and mutates snapshot", () => {
    expect(WORKBENCH_PRESET_IDS.length).toBeGreaterThan(0);
    const f = defaultPolicyWorkbenchFormState();
    const next = applyWorkbenchPresetToForm("safer", f);
    const snap = buildProposedSnapshotFromPreset("balanced", next);
    expect(snap).toBeTruthy();
    expect(typeof snap).toBe("object");
  });
});

describe("cadence and notification apply payload builders", () => {
  it("builds automation upsert with stale threshold and review envelope", () => {
    const policy = {
      id: "ap1",
      clientId: "c",
      trustId: "t",
      policyType: "stale_backlog_cleanup" as const,
      isEnabled: true,
      scheduleJson: null,
      policyConfigJson: { existing: true },
    } as AutomationPolicyRow;
    const body = buildAutomationUpsertPayloadFromCadenceForm({ policy, staleDraftDaysProposed: 18 });
    expect((body.policyConfigJson as { staleDraftDaysThreshold?: number }).staleDraftDaysThreshold).toBe(18);
    const review = buildCadenceApplyReviewPayload({ body });
    expect(review.route).toContain("automations/policies/upsert");
    expect(review.preview).toBe(body);
  });

  it("builds notification upsert and review envelope", () => {
    const policy = {
      id: "np1",
      clientId: "c",
      trustId: "t",
      eventType: "escalation",
      channelId: "ch1",
      isEnabled: true,
      minimumSeverity: "warning" as const,
      policyConfigJson: null,
    } as NotificationPolicyRow;
    const body = buildNotificationPolicyUpsertPayloadFromForm({ policy, minimumSeverity: "critical" });
    expect(body.minimumSeverity).toBe("critical");
    const review = buildNotificationApplyReviewPayload({ body });
    expect(review.route).toContain("notifications/policies/upsert");
  });
});

describe("policy recommendations", () => {
  it("returns at least one recommendation for empty sims", () => {
    const rec = generateBentleyPolicyRecommendations({
      comparison: compareBentleySimulationAgainstCurrent({}),
    });
    expect(rec.length).toBeGreaterThan(0);
  });
});

describe("runBentleyPolicyScenario resilience", () => {
  it("handles empty user and empty proposal", async () => {
    const run = await runBentleyPolicyScenario({
      userId: "",
      scenarioType: "blended",
      proposedPolicySnapshotJson: {},
    });
    expect(run.dryRun).toBe(true);
    expect(run.partialReasons.some((p) => p.includes("Cadence"))).toBe(true);
  });

  it("recommendBentleyPolicyAdjustment returns primary", () => {
    const recs = generateBentleyPolicyRecommendations({
      comparison: compareBentleySimulationAgainstCurrent({}),
    });
    const run = {
      recommendations: recs,
      comparison: compareBentleySimulationAgainstCurrent({}),
      riskSummary: { lines: [], riskFlags: [] },
    } as BentleyPolicyScenarioRunResult;
    const adj = recommendBentleyPolicyAdjustment({ run });
    expect(adj.primary.title).toBeTruthy();
  });
});
