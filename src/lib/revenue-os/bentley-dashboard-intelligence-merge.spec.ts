/** @jest-environment jsdom */
import { describe, expect, it } from "@jest/globals";
import {
  buildBentleyDashboardPayload,
  enrichDashboardFormNotesFromWorkflowArtifacts,
  mergeBentleySnapshotFromHandoffAndArtifacts,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { appendDashboardTrendsToFormNotes, buildRevenueOsAnalysisContextPayload } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";

function sampleSnapshot(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "Founders",
    traffic: 8000,
    conversionRate: 1,
    aov: 5000,
    businessName: "Acme Co",
    coreOffer: "Offer",
    transformation: "Outcome",
    platforms: ["YouTube"],
    postingPlatforms: [],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "Operator manual seed for tests.",
    ...over,
  };
}

const minimalTrendsResponse: TrendsResponse = {
  industry: "Consulting",
  targetAudience: "Founders",
  generatedAt: new Date().toISOString(),
  items: [
    {
      platform: "youtube",
      title: "Viral angle on trust",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      summary: "Why operators watch this format.",
      whyTrending: "",
      commentInsights: [],
      publishedAt: null,
      engagement: { views: 1000, likes: 10, comments: 2, confidence: "high", isEstimated: false },
    },
  ],
  campaignAngles: ["Lead with proof, not hype"],
  contentBlueprints: [],
  disclaimers: [],
};

describe("Bentley dashboard intelligence merge", () => {
  it("mergeBentleySnapshotFromHandoffAndArtifacts includes workflow trends in campaignNotes", () => {
    const snap = sampleSnapshot({ campaignNotes: "Short" });
    const payload = buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: false });
    const artifacts: BentleyWorkflowArtifacts = {
      trends: minimalTrendsResponse,
    };
    const merged = mergeBentleySnapshotFromHandoffAndArtifacts(payload, artifacts);
    expect(merged.campaignNotes).toContain("Trending content");
    expect(merged.campaignNotes).toContain("youtube");
  });

  it("enrichDashboardFormNotesFromWorkflowArtifacts augments form.notes with research and trends", () => {
    const snap = sampleSnapshot();
    const payload = buildBentleyDashboardPayload(snap);
    const form = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: "Keep this operator line visible in merged output.",
    };
    const artifacts: BentleyWorkflowArtifacts = {
      trends: minimalTrendsResponse,
      research: {
        marketOrService: "B2B advisory",
        whatPeopleWant: ["Clarity on fees"],
        marketingTips: ["Short-form proof"],
        commentsBySource: [],
        sourcesSearched: ["reddit"],
      },
    };
    const out = enrichDashboardFormNotesFromWorkflowArtifacts(form, artifacts);
    expect(out.notes).toContain("Operator notes");
    expect(out.notes).toContain("Keep this operator line visible");
    expect(out.notes).toContain("Research");
    expect(out.notes).toContain("Trending content");
  });

  it("enrichDashboardFormNotesFromWorkflowArtifacts leaves form unchanged when artifacts empty and notes empty", () => {
    const snap = sampleSnapshot({ campaignNotes: "" });
    const payload = buildBentleyDashboardPayload(snap);
    const form = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: "",
    };
    const out = enrichDashboardFormNotesFromWorkflowArtifacts(form, {});
    expect(out.notes).toBe("");
    expect(out.businessName).toBe(form.businessName);
  });

  it("appendDashboardTrendsToFormNotes appends Identify Trending block for analyze context", () => {
    const snap = sampleSnapshot();
    const payload = buildBentleyDashboardPayload(snap);
    const form = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: "Baseline notes from workflow.",
    };
    const withTrends = appendDashboardTrendsToFormNotes(form, minimalTrendsResponse);
    expect(withTrends.notes).toContain("Baseline notes");
    expect(withTrends.notes).toContain("TRENDING CONTENT PATTERNS (from Identify Trending Content)");
    const ctx = buildRevenueOsAnalysisContextPayload(withTrends);
    expect(ctx.notes).toContain("TRENDING CONTENT PATTERNS");
  });

  it("run-analysis pipeline merges workflow notes then dashboard trends into analyze context", () => {
    const snap = sampleSnapshot();
    const payload = buildBentleyDashboardPayload(snap);
    const form = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: "Seed for dashboard form.",
    };
    const artifacts: BentleyWorkflowArtifacts = {
      research: {
        marketOrService: "Advisory",
        whatPeopleWant: ["Proof"],
        marketingTips: [],
        commentsBySource: [],
        sourcesSearched: [],
      },
      marketSweep: {
        trendingTopics: ["Topic A"],
        viralHooks: [],
        painPoints: [],
        buyingSignals: [],
        commentInsights: [],
        competitorAngles: [],
        contentGaps: [],
      },
    };
    const mergedWorkflow = enrichDashboardFormNotesFromWorkflowArtifacts(form, artifacts);
    const forApi = appendDashboardTrendsToFormNotes(mergedWorkflow, minimalTrendsResponse);
    const ctx = buildRevenueOsAnalysisContextPayload(forApi);
    expect(ctx.notes).toBeDefined();
    expect(ctx.notes!).toContain("Research");
    expect(ctx.notes!).toContain("Market intelligence sweep");
    expect(ctx.notes!).toContain("TRENDING CONTENT PATTERNS (from Identify Trending Content)");
    expect(ctx.constraints?.bentley?.campaignNotes).toContain("TRENDING CONTENT PATTERNS");
  });

  it("appendDashboardTrendsToFormNotes is noop when trends null", () => {
    const snap = sampleSnapshot();
    const payload = buildBentleyDashboardPayload(snap);
    const form = {
      businessName: payload.businessName,
      businessType: payload.businessType,
      targetAudience: payload.targetAudience,
      market: payload.market,
      currentMonthlyRevenue: payload.currentMonthlyRevenue,
      targetMonthlyRevenue: payload.targetMonthlyRevenue,
      avgOrderValue: payload.avgOrderValue,
      grossMarginPct: payload.grossMarginPct,
      monthlyTraffic: payload.monthlyTraffic,
      conversionRatePct: payload.conversionRatePct,
      cac: payload.cac,
      ltv: payload.ltv,
      coreOffer: payload.coreOffer,
      transformation: payload.transformation,
      platforms: payload.platforms,
      postingPlatforms: payload.postingPlatforms,
      tone: payload.tone,
      contentTypeFocus: payload.contentTypeFocus,
      imageStyle: payload.imageStyle,
      notes: "Only manual",
    };
    expect(appendDashboardTrendsToFormNotes(form, null)).toEqual(form);
  });
});
