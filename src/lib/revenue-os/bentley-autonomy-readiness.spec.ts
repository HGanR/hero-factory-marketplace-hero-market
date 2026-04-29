import { computeBentleyAutonomyReadiness } from "@/lib/revenue-os/bentley-autonomy-readiness";
import { defaultWorkflowState } from "@/lib/revenue-os/bentley-workflow";

describe("computeBentleyAutonomyReadiness", () => {
  it("marks signed-out intake as blocked", () => {
    const r = computeBentleyAutonomyReadiness({
      signedIn: false,
      workflow: defaultWorkflowState(),
    });
    expect(r.areas.find((a) => a.id === "intake")?.status).toBe("blocked");
    expect(r.lifecycleBands).toHaveLength(4);
    expect(r.operationalBlockers).toEqual([]);
    expect(r.blockedCount).toBeGreaterThan(0);
  });

  it("includes ensure-campaign error detail when generation finished without DB id", () => {
    const wf = defaultWorkflowState();
    wf.completed.intake = true;
    wf.completed.campaign_generation = true;
    wf.artifacts.campaignPersistenceError = "network failure";
    const r = computeBentleyAutonomyReadiness({ signedIn: true, workflow: wf });
    const a = r.areas.find((x) => x.id === "campaign_persistence");
    expect(a?.status).toBe("blocked");
    expect(a?.detail).toContain("network failure");
  });

  it("reflects DB campaign id as campaign persistence ok", () => {
    const wf = defaultWorkflowState();
    wf.completed.intake = true;
    wf.completed.launch_ready = true;
    wf.artifacts.bentleyDbCampaignId = "camp-uuid-1";
    wf.artifacts.bentleyLaunchSyncedAt = new Date().toISOString();
    const r = computeBentleyAutonomyReadiness({
      signedIn: true,
      workflow: wf,
      server: {
        campaignCount: 1,
        postsForLatestCampaign: 3,
        deploymentFeedbackRows: 2,
        optimizationRunsCount: 1,
        governanceAuditRows: 1,
      },
    });
    expect(r.areas.find((a) => a.id === "campaign_persistence")?.status).toBe("ok");
    expect(r.areas.find((a) => a.id === "post_sync")?.status).toBe("ok");
    expect(r.areas.find((a) => a.id === "analytics_visibility")?.status).toBe("ok");
    expect(r.areas.find((a) => a.id === "optimization_server")?.status).toBe("ok");
    expect(r.lifecycleBands.find((b) => b.id === "launch")?.status).toBe("ok");
    expect(Array.isArray(r.operationalBlockers)).toBe(true);
  });

  it("merges server operational evaluation into areas and operationalBlockers", () => {
    const wf = defaultWorkflowState();
    wf.completed.intake = true;
    const r = computeBentleyAutonomyReadiness({
      signedIn: true,
      workflow: wf,
      server: {
        deploymentFeedbackRows: 0,
        operational: {
          issueCodes: ["launch_blocked_missing_social_account"],
          analyticsStatus: "waiting",
          analyticsReasonCode: "analytics_waiting_initial_window",
          analyticsDetail: "Within grace window",
        },
      },
    });
    expect(r.operationalBlockers.some((b) => b.code === "launch_blocked_missing_social_account")).toBe(true);
    expect(r.areas.some((a) => a.id === "operational_launch_blocked_missing_social_account")).toBe(true);
  });
});
