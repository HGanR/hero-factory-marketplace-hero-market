import { computeBentleyLaunchReadinessSummary } from "./bentley-launch-readiness-summary";
import {
  defaultWorkflowState,
  markPhaseComplete,
  type BentleyWorkflowPhaseId,
  type BentleyWorkflowState,
} from "./bentley-workflow";
import type { SocialPlatform } from "@/lib/social/config";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";

const analysisFixture = { kpis: {} } as unknown as RevenueOsAnalyzeResponse;

function pipelineThroughAnalysis(): BentleyWorkflowState {
  const order: BentleyWorkflowPhaseId[] = [
    "intake",
    "research",
    "trends",
    "market_sweep",
    "content",
    "campaign_notes",
    "campaign_generation",
    "media_brief",
    "analysis",
  ];
  let s = defaultWorkflowState();
  for (const p of order) {
    s = markPhaseComplete(s, p);
  }
  return s;
}

describe("computeBentleyLaunchReadinessSummary", () => {
  it("marks Full analysis ready from dashboard session when workflow analysis flag is false", () => {
    const summary = computeBentleyLaunchReadinessSummary({
      wf: defaultWorkflowState(),
      postingPlatforms: [],
      connectedSocialPlatforms: new Set(),
      analysis: analysisFixture,
      contentEngineOutput: null,
      hasSessionDraftMeta: false,
    });
    const row = summary.rows.find((r) => r.id === "analysis");
    expect(row?.ok).toBe(true);
    expect(row?.detail).toContain("Dashboard");
  });

  it("marks Full analysis ready from workflow without in-memory analysis", () => {
    const w = pipelineThroughAnalysis();
    const summary = computeBentleyLaunchReadinessSummary({
      wf: w,
      postingPlatforms: ["linkedin"],
      connectedSocialPlatforms: new Set<SocialPlatform>(["linkedin"]),
      analysis: null,
      contentEngineOutput: {},
      hasSessionDraftMeta: true,
    });
    const row = summary.rows.find((r) => r.id === "analysis");
    expect(row?.ok).toBe(true);
    expect(row?.detail).toContain("Bentley workflow");
  });

  it("blocked_workflow when pipeline incomplete", () => {
    let s = defaultWorkflowState();
    s = markPhaseComplete(s, "intake");
    s = markPhaseComplete(s, "research");
    const summary = computeBentleyLaunchReadinessSummary({
      wf: s,
      postingPlatforms: ["linkedin"],
      connectedSocialPlatforms: new Set<SocialPlatform>(["linkedin"]),
      analysis: null,
      contentEngineOutput: null,
      hasSessionDraftMeta: false,
    });
    expect(summary.finalKind).toBe("blocked_workflow");
  });

  it("blocked_connection when OAuth missing for a selected platform", () => {
    const summary = computeBentleyLaunchReadinessSummary({
      wf: pipelineThroughAnalysis(),
      postingPlatforms: ["linkedin", "tiktok"],
      connectedSocialPlatforms: new Set<SocialPlatform>(["linkedin"]),
      analysis: analysisFixture,
      contentEngineOutput: {},
      hasSessionDraftMeta: true,
    });
    expect(summary.finalKind).toBe("blocked_connection");
  });

  it("ready when pipeline, platforms, oauth, and asset checks pass", () => {
    const summary = computeBentleyLaunchReadinessSummary({
      wf: pipelineThroughAnalysis(),
      postingPlatforms: ["linkedin"],
      connectedSocialPlatforms: new Set<SocialPlatform>(["linkedin"]),
      analysis: analysisFixture,
      contentEngineOutput: {},
      hasSessionDraftMeta: true,
    });
    expect(summary.finalKind).toBe("ready");
  });
});
