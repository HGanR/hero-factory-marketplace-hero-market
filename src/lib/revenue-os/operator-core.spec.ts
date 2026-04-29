import { prioritizeBentleyWorkspaces } from "@/lib/revenue-os/workspace-prioritization";
import { planBentleyOperatorActions } from "@/lib/revenue-os/operator-action-planner";
import { buildBentleyOperatorDigest } from "@/lib/revenue-os/operator-digest";
import {
  buildEmptyOperatorOverview,
  mergeOperatorOverviewIntoGrowthGuidance,
} from "@/lib/revenue-os/operator-intelligence";
import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";
import { dispatchBentleyOperatorAction } from "@/lib/revenue-os/operator-run-dispatch";

function sampleSummary(partial: Partial<OperatorWorkspaceSummary> & { workspace: OperatorWorkspaceSummary["workspace"] }): OperatorWorkspaceSummary {
  return {
    queueTotal: 0,
    draftCount: 0,
    failedCount: 0,
    approvedOrScheduledCount: 0,
    publishedUnsyncedCount: 0,
    archivedCount: 0,
    blockedConnectorTargets: 0,
    promotionReadyCount: 0,
    suppressedAssetCount: 0,
    staleBacklogCount: 0,
    activeExperimentIds: [],
    openHandoffs: 0,
    handoffReadyLeads: 0,
    leadSignalTotal: 0,
    connectorPlatformsConnected: 0,
    connectorAutoPublishReady: 0,
    cadenceSummary: null,
    cadencePlan: null,
    lastCadenceRunAt: null,
    healthScore: 70,
    ...partial,
  };
}

describe("prioritizeBentleyWorkspaces", () => {
  it("ranks higher urgency when failures and blocks stack", () => {
    const a = sampleSummary({
      workspace: { clientId: "a", trustId: "t1" },
      failedCount: 2,
      blockedConnectorTargets: 1,
    });
    const b = sampleSummary({
      workspace: { clientId: "b", trustId: "t1" },
      failedCount: 0,
      promotionReadyCount: 1,
    });
    const r = prioritizeBentleyWorkspaces({ workspaceSummaries: [b, a] });
    expect(r.rankedWorkspaces[0].workspace.clientId).toBe("a");
    expect(r.topUrgentWorkspace?.workspace.clientId).toBe("a");
  });

  it("handles empty workspace list", () => {
    const r = prioritizeBentleyWorkspaces({ workspaceSummaries: [] });
    expect(r.rankedWorkspaces).toHaveLength(0);
    expect(r.topUrgentWorkspace).toBeNull();
    expect(r.topOpportunityWorkspace).toBeNull();
  });
});

describe("planBentleyOperatorActions", () => {
  it("emits retry and handoff actions when signals present", () => {
    const ws = sampleSummary({
      workspace: { clientId: "c1", trustId: "" },
      failedCount: 1,
      openHandoffs: 2,
      handoffReadyLeads: 1,
    });
    const p = prioritizeBentleyWorkspaces({ workspaceSummaries: [ws] });
    const plan = planBentleyOperatorActions({ workspaceSummaries: [ws], prioritization: p });
    expect(plan.immediateActions.some((x) => x.actionType === "retry_publish")).toBe(true);
    expect(plan.immediateActions.some((x) => x.actionType === "review_handoff_ready_leads")).toBe(true);
    expect(plan.actionSummary.length).toBeGreaterThan(0);
  });
});

describe("buildBentleyOperatorDigest", () => {
  it("builds narrative from overview", () => {
    const empty = buildEmptyOperatorOverview("u1");
    const d = buildBentleyOperatorDigest({ overview: empty });
    expect(d.headline.length).toBeGreaterThan(0);
    expect(d.shortNarrative).toBeDefined();
  });
});

describe("mergeOperatorOverviewIntoGrowthGuidance", () => {
  it("adds operator fields", () => {
    const base = mergeOperatorOverviewIntoGrowthGuidance(
      {
        recommendedNextMove: "x",
        why: "y",
        risingTopics: [],
        weakAngles: [],
        bestHookDirection: "z",
      },
      buildEmptyOperatorOverview("u1")
    );
    expect(base.systemHealthScore).toBe(100);
    expect(base.operatorActionSummary).toBeDefined();
  });
});

describe("dispatchBentleyOperatorAction", () => {
  it("dryRun approve returns ok without DB", async () => {
    const r = await dispatchBentleyOperatorAction({
      userId: "u1",
      actionType: "approve_queue_item",
      clientId: "",
      trustId: "",
      queueId: "q1",
      dryRun: true,
    });
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
  });

  it("rejects missing queueId for approve", async () => {
    const r = await dispatchBentleyOperatorAction({
      userId: "u1",
      actionType: "approve_queue_item",
      clientId: "",
      trustId: "",
      dryRun: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("queueId_required");
  });
});
