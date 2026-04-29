import { scoreLeadPriority } from "./scoreLeadPriority";
import type { ConversionSummary } from "./computeConversionSummary";
import type { TrackedLeadForAnalytics } from "./computeConversionSummary";

const baseSummary: ConversionSummary = {
  total: 5,
  contacted: 3,
  booked: 1,
  closed: 0,
  lost: 0,
  newCount: 2,
  contactedRate: 0.6,
  bookedRate: 0.2,
  closeRate: 0,
  lostRate: 0,
  totalEstimatedPipeline: 0,
  totalClosedRevenue: 0,
  byPlatform: [{ key: "tiktok", total: 5, contacted: 3, booked: 1, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.2, closeRate: 0 }],
  bySource: [],
  byPainType: [{ key: "pain-a", total: 3, contacted: 2, booked: 1, closed: 0, lost: 0, estimatedPipeline: 0, closedRevenue: 0, bookedRate: 0.33, closeRate: 0 }],
  byCommercialReadiness: [],
  byDeployment: [],
  byCtaAngle: [],
  byOfferAngle: [],
  byHookTheme: [],
};

function lead(p: Partial<TrackedLeadForAnalytics>): TrackedLeadForAnalytics {
  return {
    id: "1",
    platform: "tiktok",
    status: "new",
    source: "engagement",
    painType: "pain-a",
    intentScore: "0.7",
    commercialReadiness: "high",
    contentDeploymentId: null,
    analysisRunId: null,
    uploadId: null,
    estimatedValue: null,
    closedValue: null,
    attributionSnapshotJson: null,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    ...p,
  };
}

describe("scoreLeadPriority", () => {
  it("marks high urgency for stale new leads", () => {
    const s = scoreLeadPriority(lead({ status: "new" }), baseSummary);
    expect(s.urgency).toBeGreaterThan(0.85);
    expect(s.followUpNeeded).toBe(true);
  });

  it("boosts tier when platform and pain match top converters", () => {
    const s = scoreLeadPriority(lead({ status: "contacted", createdAt: new Date().toISOString() }), baseSummary);
    expect(s.tier).not.toBe("low");
    expect(s.closeLikelihood).toBeGreaterThan(0.4);
  });
});
