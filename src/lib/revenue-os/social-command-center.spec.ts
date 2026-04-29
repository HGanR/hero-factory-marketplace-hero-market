import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import { groupLeadSignalInboxByLane, type LeadSignalInboxRow } from "@/lib/revenue-os/lead-signal-inbox";
import { plannerColumnKeyForItem } from "@/lib/revenue-os/planner-column-keys";
import { buildBentleySocialCommandCenter } from "@/lib/revenue-os/social-command-center";

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

describe("plannerColumnKeyForItem", () => {
  it("maps manual export routing", () => {
    expect(
      plannerColumnKeyForItem({
        queue: baseQueue({ id: "1", queueStatus: "draft" }),
        worstRouting: "requires_manual_export",
      })
    ).toBe("manual_export");
  });

  it("maps approval needed draft", () => {
    expect(
      plannerColumnKeyForItem({
        queue: baseQueue({ id: "1", queueStatus: "draft", approvalStatus: "pending" }),
        worstRouting: "ready",
      })
    ).toBe("approval_needed");
  });

  it("splits failed vs retry by publish attempts", () => {
    expect(
      plannerColumnKeyForItem({
        queue: baseQueue({ id: "1", queueStatus: "failed", publishAttemptCount: 0 }),
        worstRouting: "ready",
      })
    ).toBe("failed");
    expect(
      plannerColumnKeyForItem({
        queue: baseQueue({ id: "2", queueStatus: "failed", publishAttemptCount: 2 }),
        worstRouting: "ready",
      })
    ).toBe("retry");
  });
});

describe("groupLeadSignalInboxByLane", () => {
  it("groups rows by lane", () => {
    const rows: LeadSignalInboxRow[] = [
      {
        id: "a",
        sourcePlatform: "x",
        extractedText: "hi",
        signalClass: "objection",
        commercialIntentScore: 0.5,
        urgencyScore: 0.5,
        handoffReadiness: 0.5,
        recommendedFollowup: "",
        lane: "objections",
        handoffStatus: null,
        createdAt: null,
      },
      {
        id: "b",
        sourcePlatform: "x",
        extractedText: "buy",
        signalClass: "mixed",
        commercialIntentScore: 0.9,
        urgencyScore: 0.5,
        handoffReadiness: 0.5,
        recommendedFollowup: "",
        lane: "high_intent",
        handoffStatus: null,
        createdAt: null,
      },
    ];
    const g = groupLeadSignalInboxByLane(rows);
    expect(g.objections.length).toBe(1);
    expect(g.high_intent.length).toBe(1);
  });
});

describe("buildBentleySocialCommandCenter", () => {
  it("returns resilient empty payload for blank user id", async () => {
    const { commandCenter, generatedAt } = await buildBentleySocialCommandCenter({
      userId: "",
      includeHeavyReports: false,
    });
    expect(commandCenter.kpis.length).toBe(0);
    expect(commandCenter.planner.columns.draft.length).toBe(0);
    expect(generatedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
