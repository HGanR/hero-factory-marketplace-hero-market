import { computeConversionSummary, type TrackedLeadForAnalytics } from "./computeConversionSummary";

function row(p: Partial<TrackedLeadForAnalytics>): TrackedLeadForAnalytics {
  return {
    id: "1",
    platform: "tiktok",
    status: "new",
    source: "engagement",
    painType: "time",
    intentScore: "0.5",
    commercialReadiness: null,
    contentDeploymentId: null,
    analysisRunId: null,
    uploadId: null,
    estimatedValue: null,
    closedValue: null,
    attributionSnapshotJson: null,
    createdAt: "2026-01-01",
    ...p,
  };
}

describe("computeConversionSummary", () => {
  it("aggregates totals and rates", () => {
    const rows: TrackedLeadForAnalytics[] = [
      row({ id: "a", status: "new" }),
      row({ id: "b", status: "contacted" }),
      row({ id: "c", status: "booked", estimatedValue: "1000" }),
      row({ id: "d", status: "closed", estimatedValue: "500", closedValue: "2000" }),
      row({ id: "e", status: "lost" }),
    ];
    const s = computeConversionSummary(rows);
    expect(s.total).toBe(5);
    expect(s.newCount).toBe(1);
    expect(s.contacted).toBe(4);
    expect(s.booked).toBe(2);
    expect(s.closed).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.contactedRate).toBeCloseTo(4 / 5);
    expect(s.bookedRate).toBeCloseTo(2 / 5);
    expect(s.closeRate).toBeCloseTo(1 / 5);
    expect(s.totalEstimatedPipeline).toBeCloseTo(1500);
    expect(s.totalClosedRevenue).toBeCloseTo(2000);
  });

  it("groups by platform and snapshot angles", () => {
    const snap = {
      suggestedCtaAngle: "dm",
      bestOfferAngle: "trial",
      hookSnapshot: "hook-a",
      painTheme: "burnout",
    };
    const rows: TrackedLeadForAnalytics[] = [
      row({
        id: "a",
        platform: "tiktok",
        status: "booked",
        attributionSnapshotJson: snap,
      }),
      row({
        id: "b",
        platform: "instagram",
        status: "closed",
        attributionSnapshotJson: { ...snap, suggestedCtaAngle: "link" },
      }),
    ];
    const s = computeConversionSummary(rows);
    const tt = s.byPlatform.find((d) => d.key === "tiktok");
    expect(tt?.total).toBe(1);
    expect(tt?.booked).toBe(1);
    const ctaDm = s.byCtaAngle.find((d) => d.key.includes("dm"));
    expect(ctaDm?.total).toBe(1);
  });
});
