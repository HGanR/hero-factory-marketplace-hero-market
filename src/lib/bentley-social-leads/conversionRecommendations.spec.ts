import { buildConversionRecommendations } from "./conversionRecommendations";
import type { ConversionSummary } from "./computeConversionSummary";

function emptySummary(overrides: Partial<ConversionSummary> = {}): ConversionSummary {
  return {
    total: 10,
    contacted: 6,
    booked: 3,
    closed: 1,
    lost: 0,
    newCount: 4,
    contactedRate: 0.6,
    bookedRate: 0.3,
    closeRate: 0.1,
    lostRate: 0,
    totalEstimatedPipeline: 0,
    totalClosedRevenue: 0,
    byPlatform: [
      { key: "tiktok", total: 5, contacted: 4, booked: 2, closed: 1, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.4, closeRate: 0.2 },
      { key: "instagram", total: 5, contacted: 2, booked: 1, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.2, closeRate: 0 },
    ],
    bySource: [],
    byPainType: [
      { key: "time", total: 4, contacted: 3, booked: 2, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.5, closeRate: 0 },
      { key: "(none)", total: 1, contacted: 0, booked: 0, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0, closeRate: 0 },
    ],
    byCommercialReadiness: [],
    byDeployment: [],
    byCtaAngle: [
      { key: "dm me", total: 4, contacted: 3, booked: 2, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.5, closeRate: 0 },
    ],
    byOfferAngle: [
      { key: "audit", total: 4, contacted: 3, booked: 2, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.5, closeRate: 0 },
    ],
    byHookTheme: [],
    ...overrides,
  };
}

describe("buildConversionRecommendations", () => {
  it("returns top performers and do_more entries when data supports it", () => {
    const s = emptySummary();
    const { topPerforming, recommendations } = buildConversionRecommendations(s, null);
    expect(topPerforming.platforms.length).toBeGreaterThan(0);
    expect(recommendations.some((r) => r.kind === "do_more")).toBe(true);
  });

  it("emits shift when Bentley pain differs from conversion top pain", () => {
    const s = emptySummary();
    const bentley = {
      source: "bentley_sli" as const,
      createdAt: "2026-01-01",
      basedOnFilteredRowCount: 10,
      provenance: {
        uploadId: null,
        runId: null,
        uploadSourceType: null,
        uploadFilename: null,
        csvImportFileName: null,
        csvValidRowsImported: null,
        totalRunRowCount: 10,
      },
      platformsInvolved: ["tiktok"],
      marketSummary: "x",
      topPainThemes: [{ theme: "burnout", count: 3 }],
      hooks: [],
      ctaAngles: ["ask in DMs"],
      offerAngles: [],
      objections: [],
      pillars: [],
      whatToPostNext: [],
    };
    const { recommendations } = buildConversionRecommendations(s, bentley);
    expect(recommendations.some((r) => r.kind === "shift")).toBe(true);
  });
});
