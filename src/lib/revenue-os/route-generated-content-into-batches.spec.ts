import { parseCampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";
import {
  buildPlatformHintsForContentRole,
  classifyContentForBatchRole,
  routeGeneratedContentIntoBatches,
} from "@/lib/revenue-os/route-generated-content-into-batches";

function sampleRouting(attentionPlat: string): RevenueOsPlatformRoleRoutingSummary {
  return {
    recommendations: [
      {
        role: "attention",
        preferredPlatform: attentionPlat,
        confidence: "high",
        reason: "test",
        evidenceBasis: "measured_attention",
      },
      {
        role: "engagement",
        preferredPlatform: "linkedin",
        confidence: "medium",
        reason: "test",
        evidenceBasis: "measured_engagement",
      },
      {
        role: "authority",
        preferredPlatform: "linkedin",
        confidence: "low",
        reason: "test",
        evidenceBasis: "insufficient_data",
      },
      {
        role: "lead_capture",
        preferredPlatform: null,
        confidence: "low",
        reason: "test",
        evidenceBasis: "insufficient_data",
      },
      {
        role: "distribution_support",
        preferredPlatform: null,
        confidence: "low",
        reason: "test",
        evidenceBasis: "insufficient_data",
      },
    ],
    operationalRecommendation: "Rotate by role.",
    confidenceNotes: [],
  };
}

describe("route-generated-content-into-batches", () => {
  it("classifies hook-heavy copy toward attention", () => {
    const r = classifyContentForBatchRole({
      body: "Supporting line with enough characters to pass any minimum checks easily here.",
      hook: "Stop scrolling — you need to see this POV moment.",
      source: "content_engine",
    });
    expect(r.role).toBe("attention");
    expect(r.confidence).not.toBe("low");
  });

  it("classifies educational / framework copy toward authority", () => {
    const r = classifyContentForBatchRole({
      body: "Here is a simple framework: step one, step two, step three. Research shows this pattern works for operators who need a playbook.",
      source: "campaign_from_notes",
    });
    expect(r.role).toBe("authority");
  });

  it("classifies conversation / opinion prompts toward engagement", () => {
    const r = classifyContentForBatchRole({
      body: "Hot take: most founders over-build before they validate. What do you think — agree? Comment below with your take.",
      source: "campaign_from_notes",
    });
    expect(r.role).toBe("engagement");
  });

  it("routes strong direct CTA copy to lead_capture when cues are strong enough", () => {
    const r = classifyContentForBatchRole({
      body: "Book a call this week — limited spots. Sign up now and get your free trial before the waitlist closes.",
      cta: "Apply now",
      source: "campaign_from_notes",
    });
    expect(r.role).toBe("lead_capture");
    expect(r.confidence).toBe("high");
  });

  it("falls back conservatively when signals are unclear", () => {
    const r = classifyContentForBatchRole({
      body: "Short.",
      source: "manual",
    });
    expect(r.role).toBe("distribution_support");
    expect(r.confidence).toBe("low");
  });

  it("uses platform-role routing to populate platformHints on routed items", () => {
    const ce: ContentEngineOutput = {
      captions: {
        hook: "Wait for it — plot twist nobody talks about.",
        authority: "a",
        curiosity: "c",
        controversial: "x",
        shortViral: "s",
      },
      imagePrompts: [],
      viralIdeas: [],
      hooks: [],
      fullPost: {
        caption:
          "A longer caption body that explains the idea with enough substance for routing heuristics to read clearly.",
        content: "",
        visualPrompt: "",
        hashtags: [],
      },
    };
    const routing = sampleRouting("instagram");
    const summary = routeGeneratedContentIntoBatches({
      contentEngineResult: ce,
      platformRoleRouting: routing,
      optimizationMemoryGeneration: null,
    });
    expect(summary.items.length).toBe(1);
    expect(summary.items[0]?.role).toBe("attention");
    expect(summary.items[0]?.platformHints).toEqual(["instagram"]);
    expect(summary.roleHintsFromPlatformRouting).toBe(true);
  });

  it("buildPlatformHintsForContentRole returns hints from routing summary", () => {
    const h = buildPlatformHintsForContentRole("attention", sampleRouting("tiktok"));
    expect(h).toEqual(["tiktok"]);
  });
});
