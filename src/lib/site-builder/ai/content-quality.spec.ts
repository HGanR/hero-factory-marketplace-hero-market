import { describe, expect, it } from "@jest/globals";
import { scoreContentQuality, shouldRepairContent, CONTENT_REPAIR_SCORE_THRESHOLD } from "@/lib/site-builder/ai/content-quality";
import { ContentBriefSchema } from "@/lib/site-builder/ai/content-brief-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function minimalDoc(overrides: Partial<SiteSchemaDocumentType> = {}): SiteSchemaDocumentType {
  return {
    version: 1,
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              title: "Professional services and advisory Professional services and advisory",
              subtitle: "We help clients",
              primaryCta: "Learn more",
            },
          },
        ],
      },
    ],
    metadata: {
      title: "Test",
      description: "Professional services",
    },
    ...overrides,
  } as SiteSchemaDocumentType;
}

describe("scoreContentQuality", () => {
  it("penalizes repeated phrase patterns", () => {
    const brief = ContentBriefSchema.parse({
      industry: "Consulting",
      audience: "CFOs",
      primaryOffer: "Fractional strategy",
      painPoints: [],
      trustSignals: [],
      keywordTargets: ["strategy"],
    });
    const r = scoreContentQuality(minimalDoc(), brief);
    expect(r.issues.some((i) => i.startsWith("repeated_phrase"))).toBe(true);
    expect(r.score).toBeLessThan(100);
  });

  it("high quality doc scores above threshold", () => {
    const doc = minimalDoc({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                title: "Slashing infrastructure spend for mid-market finance teams in 90 days",
                subtitle: "We map cost leaks, align leadership, and ship a roadmap your board can defend.",
                primaryCta: "Book a 20-min discovery",
                secondaryCta: "Get sample outcomes deck",
              },
            },
            { type: "button", content: { label: "Request audit scope" } },
          ],
        },
      ],
      metadata: {
        title: "FinCost — cost intelligence for finance leaders",
        description: "We help CFOs cut run-rate spend without headcount drama.",
      },
    });
    const brief = ContentBriefSchema.parse({
      industry: "Advisory",
      audience: "CFOs and heads of finance",
      primaryOffer: "Cost and vendor rationalization sprints with board-ready scorecards",
      painPoints: ["Waste"],
      trustSignals: ["10+ enterprise audits"],
      keywordTargets: ["finance", "CFO", "spend"],
    });
    const r = scoreContentQuality(doc, brief);
    expect(r.score).toBeGreaterThanOrEqual(CONTENT_REPAIR_SCORE_THRESHOLD);
  });
});

describe("shouldRepairContent", () => {
  it("is true when score is below threshold", () => {
    expect(shouldRepairContent(50)).toBe(true);
  });
  it("is false when at or above threshold", () => {
    expect(shouldRepairContent(CONTENT_REPAIR_SCORE_THRESHOLD)).toBe(false);
    expect(shouldRepairContent(90)).toBe(false);
  });
});
