/**
 * Golden-path regression: canonical fixture used across handoff + deployment stage machine.
 * Business: TROOTHHERTZ · Consulting · Entrepreneurs · TikTok posting intent.
 */
import { advanceBentleyPipelineStage } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";
import {
  buildBentleyDashboardPayload,
  bentleySnapshotFromHandoffPayload,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { intakeComplete, type BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { defaultWorkflowState, type BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";

function troothertzConsultingEntrepreneursTikTok(): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "Entrepreneurs",
    traffic: 8000,
    conversionRate: 1,
    aov: 5000,
    businessName: "TROOTHHERTZ",
    coreOffer: "Capital architecture",
    transformation: "Revenue growth",
    platforms: ["TikTok"],
    postingPlatforms: ["tiktok"],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "Growth focus",
  };
}

function workflowReadyForDeploymentDrafts(): BentleyWorkflowState {
  return {
    ...defaultWorkflowState(),
    completed: {
      intake: true,
      research: true,
      trends: true,
    },
    artifacts: {
      research: {} as never,
      trends: {} as never,
      contentEngine: {} as never,
      campaign: {} as never,
    },
    updatedAt: Date.now(),
  };
}

describe("Golden path: TROOTHHERTZ / Consulting / Entrepreneurs / TikTok", () => {
  it("round-trips dashboard handoff and keeps TikTok as the posting target", () => {
    const snap = troothertzConsultingEntrepreneursTikTok();
    expect(snap.contentIndustry).toBe("Consulting");
    expect(snap.targetAudience).toBe("Entrepreneurs");
    expect(snap.postingPlatforms).toEqual(["tiktok"]);

    const raw = serializeBentleyDashboardHandoff({
      payload: buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: false }),
    });
    const merged = bentleySnapshotFromHandoffPayload(JSON.parse(raw).payload);
    expect(merged.postingPlatforms).toEqual(["tiktok"]);
    expect(intakeComplete(merged)).toBe(true);
    expect(merged.businessName).toBe("TROOTHHERTZ");
  });

  it("stage machine: after drafts exist, prompts connect_accounts until TikTok OAuth is linked", () => {
    const snap = troothertzConsultingEntrepreneursTikTok();
    const wf = workflowReadyForDeploymentDrafts();

    const needConnect = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wf,
      deploymentDraftCount: 1,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: snap.postingPlatforms,
    });
    expect(needConnect.stage).toBe("connect_accounts");
    expect(needConnect.shouldOpenConnectFlow).toBe(true);

    const readyToSchedule = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wf,
      deploymentDraftCount: 1,
      connectedOauthPlatforms: ["tiktok"],
      targetOauthPlatforms: snap.postingPlatforms,
    });
    expect(readyToSchedule.stage).toBe("schedule_review");
    expect(readyToSchedule.shouldOpenScheduleReview).toBe(true);
  });
});
