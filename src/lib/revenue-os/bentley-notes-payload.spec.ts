import { buildBentleyNotesPayload } from "@/lib/revenue-os/bentley-notes-payload";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";

describe("buildBentleyNotesPayload", () => {
  it("merges snapshot notes with research and trends", () => {
    const snapshot = {
      businessName: "Acme",
      industryKey: null,
      contentIndustry: "SaaS",
      targetAudience: "Founders",
      coreOffer: "CRM",
      transformation: "More revenue",
      platforms: ["LinkedIn"],
      postingPlatforms: [],
      tone: "Professional",
      contentType: "Post",
      imageStyle: "Clean",
      traffic: 0,
      conversionRate: 0,
      aov: 0,
      campaignNotes: "Seed note",
      skipCampaignNotes: false,
    } as unknown as BentleySnapshot;

    const out = buildBentleyNotesPayload({
      snapshot,
      research: {
        marketOrService: "CRM",
        whatPeopleWant: ["faster pipeline"],
        commentsBySource: [],
        marketingTips: [],
        sourcesSearched: [],
      },
      trends: {
        items: [{ title: "Trend A", platform: "linkedin", summary: "S", url: "https://x" }],
        campaignAngles: ["Angle 1"],
      },
    });

    expect(out).toContain("Seed note");
    expect(out).toContain("Research");
    expect(out).toContain("Trend A");
    expect(out.length).toBeGreaterThan(50);
  });

  it("includes market intelligence sweep when present", () => {
    const snapshot = {
      campaignNotes: "",
      skipCampaignNotes: false,
    } as unknown as import("@/lib/revenue-os/bentley-orchestrator").BentleySnapshot;

    const out = buildBentleyNotesPayload({
      snapshot,
      marketSweep: {
        trendingTopics: ["Topic A"],
        viralHooks: ["Hook 1"],
        painPoints: ["Pain 1"],
        buyingSignals: ["Buy 1"],
        commentInsights: ["Insight"],
        competitorAngles: ["Angle"],
        contentGaps: ["Gap"],
        hybridMeta: { realSignalCount: 1, sourcesConnected: ["reddit"] },
      },
    });

    expect(out).toContain("Market intelligence sweep");
    expect(out).toContain("Topic A");
  });
});
