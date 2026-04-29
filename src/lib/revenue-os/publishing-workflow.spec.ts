import { buildPublishingWorkflow, buildWorkflowOperationalGuidance } from "./publishing-workflow";
import type { DistributionQueueRow } from "./distribution-queue-actions";

function row(partial: Partial<DistributionQueueRow> & Pick<DistributionQueueRow, "id" | "queueStatus" | "approvalStatus">): DistributionQueueRow {
  return {
    userId: "1",
    clientId: "",
    trustId: "",
    experimentId: null,
    experimentVariantId: null,
    title: "t",
    platform: "Instagram",
    contentType: "Reel",
    scheduledFor: null,
    publishedAt: null,
    publishPriority: 5,
    publishAttemptCount: 0,
    lastPublishError: null,
    externalPostRef: null,
    lastSyncedAt: null,
    performanceSyncStatus: null,
    leadHandoffStatus: null,
    workflowNote: null,
    winningSignalSource: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("buildPublishingWorkflow", () => {
  it("classifies approval vs schedule vs sync", () => {
    const items: DistributionQueueRow[] = [
      row({ id: "a", queueStatus: "draft", approvalStatus: "pending" }),
      row({ id: "b", queueStatus: "approved", approvalStatus: "approved" }),
      row({
        id: "c",
        queueStatus: "published",
        approvalStatus: "approved",
        performanceSyncStatus: "pending",
        lastSyncedAt: null,
      }),
    ];
    const w = buildPublishingWorkflow({
      distributionPlan: null,
      queueItems: items,
      approvalsRequired: true,
    });
    expect(w.readyToApprove.some((x) => x.queueId === "a")).toBe(true);
    expect(w.readyToSchedule.some((x) => x.queueId === "b")).toBe(true);
    expect(w.itemsNeedingPerformanceSync.some((x) => x.queueId === "c")).toBe(true);
  });

  it("resilience: empty queue", () => {
    const w = buildPublishingWorkflow({ distributionPlan: null, queueItems: [], approvalsRequired: true });
    expect(w.workflowSummary.length).toBeGreaterThan(0);
    expect(w.readyToApprove.length).toBe(0);
  });
});

describe("buildWorkflowOperationalGuidance", () => {
  it("produces bottleneck lines", () => {
    const g = buildWorkflowOperationalGuidance({
      workflow: {
        readyToApprove: [{ queueId: "x", title: "t", platform: "ig", actions: ["approve"], reason: "r" }],
        readyToSchedule: [],
        readyToPublish: [],
        itemsNeedingPerformanceSync: [],
        blockedItems: [],
        retryItems: [],
        workflowSummary: "1 item(s) need approval.",
      },
      handoffOpenCount: 2,
    });
    expect(g.approvalBottleneckLine).toContain("approval");
    expect(g.handoffBacklogLine).toContain("handoff");
  });
});
