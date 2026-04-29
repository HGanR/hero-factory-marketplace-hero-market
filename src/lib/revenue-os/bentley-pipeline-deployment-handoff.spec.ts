import { advanceBentleyPipelineStage } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";
import { defaultWorkflowState, type BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";

function wfThroughCampaign(): BentleyWorkflowState {
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

describe("advanceBentleyPipelineStage (deployment handoff / stage machine)", () => {
  it("blocks automation until intake is complete", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: false,
      workflow: defaultWorkflowState(),
      deploymentDraftCount: 0,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: ["tiktok"],
    });
    expect(r.stage).toBe("intake");
    expect(r.shouldResumeAutomatedPipeline).toBe(false);
  });

  it("prefers research when research milestones are missing", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: defaultWorkflowState(),
      deploymentDraftCount: 0,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: [],
    });
    expect(r.stage).toBe("research_and_trends");
    expect(r.shouldResumeAutomatedPipeline).toBe(true);
  });

  it("asks for trends when research exists but trends do not", () => {
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { intake: true, research: true },
      artifacts: { research: {} as never },
      updatedAt: Date.now(),
    };
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wf,
      deploymentDraftCount: 0,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: [],
    });
    expect(r.stage).toBe("research_and_trends");
    expect(r.headline).toContain("trending");
  });

  it("moves to deployment drafts when campaign exists but no drafts are prepared", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wfThroughCampaign(),
      deploymentDraftCount: 0,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: ["tiktok"],
    });
    expect(r.stage).toBe("deployment_drafts");
    expect(r.shouldOpenDeploymentPanel).toBe(true);
    expect(r.shouldOpenConnectFlow).toBe(false);
  });

  it("when drafts exist but OAuth targets are not connected, surfaces connect_accounts", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wfThroughCampaign(),
      deploymentDraftCount: 2,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: ["tiktok", "linkedin"],
    });
    expect(r.stage).toBe("connect_accounts");
    expect(r.shouldOpenConnectFlow).toBe(true);
    expect(r.shouldOpenDeploymentPanel).toBe(true);
    expect(r.shouldResumeAutomatedPipeline).toBe(false);
  });

  it("when all target platforms are connected, moves to schedule_review", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wfThroughCampaign(),
      deploymentDraftCount: 1,
      connectedOauthPlatforms: ["tiktok"],
      targetOauthPlatforms: ["tiktok"],
    });
    expect(r.stage).toBe("schedule_review");
    expect(r.shouldOpenScheduleReview).toBe(true);
    expect(r.shouldOpenConnectFlow).toBe(false);
  });

  it("treats empty target list as satisfied for connection (schedule_review after drafts)", () => {
    const r = advanceBentleyPipelineStage({
      intakeComplete: true,
      workflow: wfThroughCampaign(),
      deploymentDraftCount: 3,
      connectedOauthPlatforms: [],
      targetOauthPlatforms: [],
    });
    expect(r.stage).toBe("schedule_review");
  });
});
