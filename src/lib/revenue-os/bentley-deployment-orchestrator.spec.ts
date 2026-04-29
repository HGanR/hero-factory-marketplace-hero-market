import { parseCampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import {
  buildDeploymentReadyPostDrafts,
  buildStableBentleyDraftKey,
  computeDeploymentReadiness,
  getDeploymentDraftBlockers,
} from "@/lib/revenue-os/bentley-deployment-orchestrator";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";
import { buildContentBatchCalendarSequence } from "@/lib/revenue-os/build-content-batch-calendar-sequence";
import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import {
  emptyCountsByRole,
  type RevenueOsContentBatchRoutingSummary,
  type RevenueOsRoutedContentItem,
} from "@/lib/revenue-os/content-batch-routing-types";

const shared = { postingPlatforms: ["Instagram"] };

const signalsFull: RevenueOsSystemSignals = {
  opportunityScore: 70,
  offerStrengthScore: 65,
  trafficReadinessScore: 62,
  executionGapScore: 40,
  capitalReadinessScore: 50,
};

function sampleCampaign() {
  return parseCampaignResponse({
    industry: "Coaching",
    targetAudience: "Founders",
    offerStatement: "Ship your first paid offer in 14 days with a simple offer ladder.",
    messagePillars: ["Clarity", "Speed", "Proof"],
    shortFormHooks: ["Stop guessing your niche—validate demand first."],
    longFormOutlines: [],
    objectionReplies: ["Too expensive", "No time", "Tried before", "Need ROI", "Not sure"],
  });
}

function sampleContentEngine(): ContentEngineOutput {
  return {
    captions: {
      hook: "Test hook",
      authority: "a",
      curiosity: "c",
      controversial: "x",
      shortViral: "s",
    },
    imagePrompts: ["A cinematic product shot"],
    viralIdeas: [],
    hooks: [],
    fullPost: {
      caption:
        "Here is a substantive caption for deployment that exceeds the minimum length requirement easily.",
      content: "",
      visualPrompt: "",
      hashtags: ["growth", "founder"],
    },
  };
}

describe("bentley-deployment-orchestrator", () => {
  it("buildDeploymentReadyPostDrafts returns drafts for campaign + connected-ready platforms", () => {
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: sampleCampaign(),
      systemSignals: signalsFull,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0]?.platform).toBe("instagram");
    expect(drafts[0]?.status).toBe("draft");
    expect(drafts[0]?.source).toBe("campaign_from_notes");
    expect(drafts[0]?.draftKey).toContain("bentley:campaign_from_notes:instagram:0:");
  });

  it("computeDeploymentReadiness is ready when accounts cover drafts and posts exist", () => {
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: sampleCampaign(),
    });
    expect(drafts.length).toBe(1);
    const dk = drafts[0]!.draftKey;
    const r = computeDeploymentReadiness({
      sharedProfile: shared,
      campaignResult: sampleCampaign(),
      socialAccounts: [{ platform: "instagram", platformCanonical: "instagram" }],
      existingPosts: [{ platform: "instagram", utmParams: { bentley_draft_key: dk } }],
    });
    expect(r.isReady).toBe(true);
    expect(r.strengths.some((s) => s.includes("Connected accounts"))).toBe(true);
  });

  it("computeDeploymentReadiness blocks when outputs exist but no accounts", () => {
    const r = computeDeploymentReadiness({
      sharedProfile: shared,
      campaignResult: sampleCampaign(),
      socialAccounts: [],
      existingPosts: undefined,
    });
    expect(r.isReady).toBe(false);
    expect(r.blockers.some((b) => b.includes("No connected OAuth"))).toBe(true);
  });

  it("returns empty drafts and blockers when no substantive outputs", () => {
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: undefined,
      contentEngineResult: undefined,
      mediaBrief: null,
      launchPlan: undefined,
    });
    expect(drafts).toEqual([]);
    const b = getDeploymentDraftBlockers({
      sharedProfile: shared,
    });
    expect(b.length).toBeGreaterThan(0);
  });

  it("buildStableBentleyDraftKey is deterministic", () => {
    const a = buildStableBentleyDraftKey({
      source: "content_engine",
      platform: "linkedin",
      index: 0,
      bodySnippet: "same body",
    });
    const b = buildStableBentleyDraftKey({
      source: "content_engine",
      platform: "linkedin",
      index: 0,
      bodySnippet: "same body",
    });
    expect(a).toBe(b);
  });

  it("prefers campaign over content engine when both substantial", () => {
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: { postingPlatforms: ["LinkedIn"] },
      campaignResult: sampleCampaign(),
      contentEngineResult: sampleContentEngine(),
    });
    expect(drafts[0]?.source).toBe("campaign_from_notes");
  });

  it("adds bentley content role + platform hints when applyContentBatchMetadata and routing summary are set", () => {
    const routing: RevenueOsPlatformRoleRoutingSummary = {
      recommendations: [
        {
          role: "attention",
          preferredPlatform: "instagram",
          confidence: "high",
          reason: "x",
          evidenceBasis: "measured_attention",
        },
        {
          role: "engagement",
          preferredPlatform: "linkedin",
          confidence: "medium",
          reason: "x",
          evidenceBasis: "measured_engagement",
        },
        {
          role: "authority",
          preferredPlatform: "linkedin",
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "lead_capture",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "distribution_support",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
      ],
      operationalRecommendation: "",
      confidenceNotes: [],
    };
    const c = parseCampaignResponse({
      industry: "Coaching",
      targetAudience: "Founders",
      offerStatement: "Ship your first paid offer in 14 days with a simple offer ladder.",
      messagePillars: ["Clarity", "Speed", "Proof"],
      shortFormHooks: ["Stop scrolling — POV: the real reason launches stall."],
      longFormOutlines: [],
      objectionReplies: ["Too expensive", "No time", "Tried before", "Need ROI", "Not sure"],
    });
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: c,
      systemSignals: signalsFull,
      platformRoleRoutingSummary: routing,
      applyContentBatchMetadata: true,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0]?.bentleyContentRole).toBe("attention");
    expect(drafts[0]?.bentleyPlatformHints).toEqual(["instagram"]);
  });

  it("adds sequence metadata when applySequenceMetadata and batch calendar sequence are set", () => {
    const routing: RevenueOsPlatformRoleRoutingSummary = {
      recommendations: [
        {
          role: "attention",
          preferredPlatform: "instagram",
          confidence: "high",
          reason: "x",
          evidenceBasis: "measured_attention",
        },
        {
          role: "engagement",
          preferredPlatform: "linkedin",
          confidence: "medium",
          reason: "x",
          evidenceBasis: "measured_engagement",
        },
        {
          role: "authority",
          preferredPlatform: "linkedin",
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "lead_capture",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "distribution_support",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
      ],
      operationalRecommendation: "",
      confidenceNotes: [],
    };
    const counts = emptyCountsByRole();
    counts.attention = 1;
    const items: RevenueOsRoutedContentItem[] = [
      {
        id: "att-0",
        source: "campaign_from_notes",
        role: "attention",
        confidence: "high",
        body: "x".repeat(50),
        reason: "t",
      },
    ];
    const batchRouting: RevenueOsContentBatchRoutingSummary = {
      items,
      countsByRole: counts,
      recommendedPlatformsByRole: {},
      nextAction: "",
      roleHintsFromPlatformRouting: true,
    };
    const calendarSeq = buildContentBatchCalendarSequence({
      batchRouting,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    expect(calendarSeq.slots.length).toBeGreaterThan(0);
    const c = parseCampaignResponse({
      industry: "Coaching",
      targetAudience: "Founders",
      offerStatement: "Ship your first paid offer in 14 days with a simple offer ladder.",
      messagePillars: ["Clarity", "Speed", "Proof"],
      shortFormHooks: ["Stop scrolling — POV: the real reason launches stall."],
      longFormOutlines: [],
      objectionReplies: ["Too expensive", "No time", "Tried before", "Need ROI", "Not sure"],
    });
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: c,
      systemSignals: signalsFull,
      platformRoleRoutingSummary: routing,
      applyContentBatchMetadata: true,
      batchCalendarSequence: calendarSeq,
      applySequenceMetadata: true,
    });
    expect(drafts.length).toBe(1);
    const attSlot = calendarSeq.slots.find((s) => s.role === "attention");
    expect(drafts[0]?.bentleyContentRole).toBe("attention");
    expect(drafts[0]?.bentleySequenceDayIndex).toBe(attSlot?.dayIndex);
    expect(drafts[0]?.bentleySequenceRole).toBe("attention");
    expect(drafts[0]?.bentleySequenceReason).toBeTruthy();
  });

  it("adds suggested schedule fields when schedule plan + applySequenceScheduleMetadata are set", () => {
    const routing: RevenueOsPlatformRoleRoutingSummary = {
      recommendations: [
        {
          role: "attention",
          preferredPlatform: "instagram",
          confidence: "high",
          reason: "x",
          evidenceBasis: "measured_attention",
        },
        {
          role: "engagement",
          preferredPlatform: "linkedin",
          confidence: "medium",
          reason: "x",
          evidenceBasis: "measured_engagement",
        },
        {
          role: "authority",
          preferredPlatform: "linkedin",
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "lead_capture",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
        {
          role: "distribution_support",
          preferredPlatform: null,
          confidence: "low",
          reason: "x",
          evidenceBasis: "insufficient_data",
        },
      ],
      operationalRecommendation: "",
      confidenceNotes: [],
    };
    const counts = emptyCountsByRole();
    counts.attention = 1;
    const items: RevenueOsRoutedContentItem[] = [
      {
        id: "att-0",
        source: "campaign_from_notes",
        role: "attention",
        confidence: "high",
        body: "x".repeat(50),
        reason: "t",
      },
    ];
    const batchRouting: RevenueOsContentBatchRoutingSummary = {
      items,
      countsByRole: counts,
      recommendedPlatformsByRole: {},
      nextAction: "",
      roleHintsFromPlatformRouting: true,
    };
    const calendarSeq = buildContentBatchCalendarSequence({
      batchRouting,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    const schedulePlan = buildSequenceSchedulePlan({
      batchCalendarSequence: calendarSeq,
      now: new Date("2025-06-10T12:00:00.000Z"),
      userTimezoneHint: null,
    });
    const c = parseCampaignResponse({
      industry: "Coaching",
      targetAudience: "Founders",
      offerStatement: "Ship your first paid offer in 14 days with a simple offer ladder.",
      messagePillars: ["Clarity", "Speed", "Proof"],
      shortFormHooks: ["Stop scrolling — POV: the real reason launches stall."],
      longFormOutlines: [],
      objectionReplies: ["Too expensive", "No time", "Tried before", "Need ROI", "Not sure"],
    });
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: c,
      systemSignals: signalsFull,
      platformRoleRoutingSummary: routing,
      applyContentBatchMetadata: true,
      batchCalendarSequence: calendarSeq,
      applySequenceMetadata: true,
      sequenceSchedulePlan: schedulePlan,
      applySequenceScheduleMetadata: true,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0]?.suggestedScheduledAt).toBeTruthy();
    expect(drafts[0]?.bentleyScheduleRole).toBe("attention");
    expect(drafts[0]?.bentleyScheduleConfidence).toBeTruthy();
  });

  it("uses launch plan when campaign thin but launch objective present", () => {
    const launchPlan: RevenueOsLaunchModePlan = {
      summary: "test",
      days: [
        {
          day: 1,
          title: "T",
          objective: "Ship a concrete first post and one CTA path for your ideal buyer today.",
          tasks: ["a", "b"],
          deliverables: ["c"],
        },
      ],
      readiness: { isReady: true, blockers: [], strengths: [] },
    };
    const drafts = buildDeploymentReadyPostDrafts({
      sharedProfile: shared,
      campaignResult: undefined,
      contentEngineResult: undefined,
      launchPlan,
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0]?.source).toBe("launch_mode");
  });
});
