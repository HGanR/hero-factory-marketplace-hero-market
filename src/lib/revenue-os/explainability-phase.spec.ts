import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import {
  explainBentleyAutonomousAction,
  explainBentleyGrowthGuidance,
  explainBentleyQueueAction,
} from "@/lib/revenue-os/explainability-engine";
import { simulateBentleyAutonomousPolicies, simulateBentleyCadencePolicies } from "@/lib/revenue-os/policy-simulation";
import { compareBentleySimulationAgainstCurrent } from "@/lib/revenue-os/simulation-comparator";
import { buildExplanationCardPayload } from "@/lib/revenue-os/explainability-ui";
import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";

function baseQueue(partial: Partial<DistributionQueueRow> & Pick<DistributionQueueRow, "id">): DistributionQueueRow {
  const now = new Date();
  return {
    userId: "u1",
    clientId: "c1",
    trustId: "t1",
    experimentId: null,
    experimentVariantId: null,
    title: "t",
    platform: "linkedin",
    contentType: "feed",
    queueStatus: "draft",
    approvalStatus: "pending",
    scheduledFor: null,
    publishedAt: null,
    publishPriority: null,
    publishAttemptCount: 0,
    lastPublishError: null,
    externalPostRef: null,
    lastSyncedAt: null,
    performanceSyncStatus: null,
    leadHandoffStatus: null,
    workflowNote: null,
    winningSignalSource: null,
    cadencePriority: null,
    staleAfterAt: null,
    lastOptimizationAction: null,
    suppressionReason: null,
    promotionReason: null,
    retestEligibleAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("explainBentleyGrowthGuidance", () => {
  it("degrades when guidance is null", () => {
    const ex = explainBentleyGrowthGuidance({ guidance: null });
    expect(ex.decisionSummary).toMatch(/No growth guidance/i);
    expect(ex.recommendedHumanReview).toBe(true);
  });
});

describe("explainBentleyQueueAction", () => {
  it("explains manual export routing", () => {
    const ex = explainBentleyQueueAction({
      queue: baseQueue({ id: "q1", queueStatus: "draft" }),
      routedTargets: [
        {
          targetId: "t1",
          queueId: "q1",
          targetPlatform: "linkedin",
          targetFormat: "feed",
          selectedProfileId: null,
          routingStatus: "requires_manual_export",
          payloadJson: {},
          routingWarnings: ["needs export"],
        },
      ],
    });
    expect(ex.decisionSummary).toMatch(/manual_export|manual export|routing/i);
  });
});

describe("explainBentleyAutonomousAction", () => {
  it("explains require_approval from evaluation", () => {
    const policy = {
      id: "p1",
      userId: "u1",
      clientId: "",
      trustId: "",
      actionType: "auto_archive_stale_draft",
      isEnabled: true,
      requiresApprovalAboveSeverity: "warning",
      maxDailyExecutions: null,
      cooldownMinutes: null,
      policyConfigJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AutonomousPolicyRow;

    const ex = explainBentleyAutonomousAction({
      candidate: {
        actionType: "auto_archive_stale_draft",
        scope: { clientId: "", trustId: "" },
        reason: "x",
        riskLevel: "high",
        confidence: 0.9,
        sourceSystem: "test",
        targetIds: ["a"],
        estimatedImpact: "low",
      },
      policy,
      evaluation: {
        outcome: "require_approval",
        severity: "warning",
        rationale: ["severity meets threshold"],
        confidenceScore: 0.9,
      },
    });
    expect(ex.recommendedHumanReview).toBe(true);
    expect(ex.whyChosen.join(" ")).toMatch(/severity/i);
  });
});

describe("policy simulation", () => {
  it("simulates autonomous deltas without mutation", () => {
    const policy = {
      id: "pol1",
      userId: "u1",
      clientId: "",
      trustId: "",
      actionType: "auto_archive_stale_draft",
      isEnabled: true,
      requiresApprovalAboveSeverity: "critical",
      maxDailyExecutions: 10,
      cooldownMinutes: null,
      policyConfigJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AutonomousPolicyRow;

    const sim = simulateBentleyAutonomousPolicies({
      candidates: [
        {
          actionType: "auto_archive_stale_draft",
          scope: { clientId: "c", trustId: "t" },
          reason: "stale",
          riskLevel: "high",
          confidence: 0.9,
          sourceSystem: "t",
          targetIds: ["x"],
          estimatedImpact: "low",
        },
      ],
      policiesCurrent: [policy],
      policyPatchesById: { pol1: { requiresApprovalAboveSeverity: "warning" } },
      contextByCandidateIndex: [
        {
          hasOpenBlockingIssue: false,
          connectorReady: true,
          recentFailuresForTarget: 0,
          executionsToday: 0,
          policyCooldownActive: false,
        },
      ],
    });
    expect(sim.dryRun).toBe(true);
    const cmp = compareBentleySimulationAgainstCurrent({ autonomous: sim });
    expect(cmp.summaryDelta).toBeTruthy();
  });

  it("simulates cadence stale counts", () => {
    const old = new Date(Date.now() - 40 * 86400 * 1000);
    const sim = simulateBentleyCadencePolicies({
      queueItems: [baseQueue({ id: "q1", queueStatus: "draft", createdAt: old })],
      staleDaysCurrent: 30,
      staleDaysProposed: 14,
    });
    expect(sim.dryRun).toBe(true);
    expect(sim.staleDraftsEligibleProposed).toBeGreaterThanOrEqual(sim.staleDraftsEligibleCurrent);
  });
});

describe("explainability-ui", () => {
  it("builds card payload", () => {
    const ex = explainBentleyGrowthGuidance({ guidance: null });
    const card = buildExplanationCardPayload(ex);
    expect(card.title).toBeTruthy();
    expect(card.summary).toBeTruthy();
  });
});
