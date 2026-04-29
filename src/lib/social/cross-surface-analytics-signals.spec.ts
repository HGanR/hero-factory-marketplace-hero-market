/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  deriveCrossSurfaceAnalyticsSignals,
  deriveCrossSurfaceComparisonReadiness,
  deriveCrossSurfacePromotionOutcomes,
  meetsCrossSurfacePromotionMinimumSample,
} from "@/lib/social/cross-surface-analytics-signals";

describe("deriveCrossSurfaceAnalyticsSignals", () => {
  it("returns only organic_candidate when paid metrics missing", () => {
    const r = deriveCrossSurfaceAnalyticsSignals({
      organicMetrics: { impressions: 10_000 },
      paidMetrics: null,
      organicPromotion: { signals: [{ code: "x", label: "L", hint: "H" }], candidateForPromotion: true },
    });
    expect(r.map((x) => x.code)).toEqual(["organic_candidate_for_promotion"]);
  });

  it("flags organic_outperforming_paid when organic crushes paid delivery", () => {
    const r = deriveCrossSurfaceAnalyticsSignals({
      organicMetrics: { impressions: 6000, engagementsTotal: 500 },
      paidMetrics: { impressions: 1000, clicks: 2, spendMinor: null, reach: null, cpcMinor: null, cpmMinor: null, ctr: null },
      organicPromotion: { signals: [], candidateForPromotion: false },
    });
    expect(r.some((s) => s.code === "organic_outperforming_paid")).toBe(true);
  });

  it("flags paid_underperforming_baseline on low CTR with volume", () => {
    const r = deriveCrossSurfaceAnalyticsSignals({
      organicMetrics: {},
      paidMetrics: {
        impressions: 500,
        clicks: 0,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: 0.0005,
      },
      organicPromotion: { signals: [], candidateForPromotion: false },
    });
    expect(r.some((s) => s.code === "paid_underperforming_baseline")).toBe(true);
  });

  it("returns empty when nothing applies and not a candidate", () => {
    const r = deriveCrossSurfaceAnalyticsSignals({
      organicMetrics: { impressions: 10 },
      paidMetrics: { impressions: 10, clicks: 1, spendMinor: null, reach: null, cpcMinor: null, cpmMinor: null, ctr: 0.05 },
      organicPromotion: { signals: [], candidateForPromotion: false },
    });
    expect(r).toEqual([]);
  });
});

describe("deriveCrossSurfacePromotionOutcomes (Part 61)", () => {
  it("returns null when paid impressions missing", () => {
    expect(
      deriveCrossSurfacePromotionOutcomes({
        organicMetrics: { impressions: 1000 },
        paidMetrics: { impressions: null, clicks: 5, spendMinor: null, reach: null, cpcMinor: null, cpmMinor: null, ctr: null },
      })
    ).toBeNull();
  });

  it("Part 64: returns null when paid impressions are below minimum sample", () => {
    expect(
      meetsCrossSurfacePromotionMinimumSample(
        { impressions: 1000, engagementsTotal: 30 },
        {
          impressions: 99,
          clicks: 1,
          spendMinor: null,
          reach: null,
          cpcMinor: null,
          cpmMinor: null,
          ctr: null,
        }
      )
    ).toBe(false);
    expect(
      deriveCrossSurfacePromotionOutcomes({
        organicMetrics: { impressions: 1000, engagementsTotal: 30 },
        paidMetrics: {
          impressions: 99,
          clicks: 1,
          spendMinor: null,
          reach: null,
          cpcMinor: null,
          cpmMinor: null,
          ctr: null,
        },
      })
    ).toBeNull();
  });

  it("Part 64: returns null when organic base is below minimum sample", () => {
    expect(
      meetsCrossSurfacePromotionMinimumSample(
        { impressions: 50, engagementsTotal: 5 },
        {
          impressions: 500,
          clicks: 2,
          spendMinor: null,
          reach: null,
          cpcMinor: null,
          cpmMinor: null,
          ctr: null,
        }
      )
    ).toBe(false);
    expect(
      deriveCrossSurfacePromotionOutcomes({
        organicMetrics: { impressions: 50, engagementsTotal: 5 },
        paidMetrics: {
          impressions: 500,
          clicks: 2,
          spendMinor: null,
          reach: null,
          cpcMinor: null,
          cpmMinor: null,
          ctr: null,
        },
      })
    ).toBeNull();
  });

  it("promotion_effective when paid impressions ≥ 1.5× organic", () => {
    const o = deriveCrossSurfacePromotionOutcomes({
      organicMetrics: { impressions: 1000, engagementsTotal: 30 },
      paidMetrics: {
        impressions: 1500,
        clicks: 1,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(o).not.toBeNull();
    expect(o!.promotionEffective).toBe(true);
    expect(o!.promotionInefficient).toBe(false);
    expect(o!.paidOutperformingOrganic).toBe(true);
  });

  it("returns inconclusive booleans when metrics do not cross thresholds", () => {
    const o = deriveCrossSurfacePromotionOutcomes({
      organicMetrics: { impressions: 1000, engagementsTotal: 30 },
      paidMetrics: {
        impressions: 900,
        clicks: 27,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(o!.promotionEffective).toBe(false);
    expect(o!.promotionInefficient).toBe(false);
  });

  it("promotion_inefficient when paid impressions < 0.75× organic", () => {
    const o = deriveCrossSurfacePromotionOutcomes({
      organicMetrics: { impressions: 1000, engagementsTotal: 30 },
      paidMetrics: {
        impressions: 700,
        clicks: 1,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(o).not.toBeNull();
    expect(o!.promotionInefficient).toBe(true);
    expect(o!.promotionEffective).toBe(false);
  });

  it("prefers effective over inefficient when rate outperforms despite lower volume", () => {
    const o = deriveCrossSurfacePromotionOutcomes({
      organicMetrics: { impressions: 2000, engagementsTotal: 100 },
      paidMetrics: {
        impressions: 1200,
        clicks: 120,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(o!.promotionEffective).toBe(true);
    expect(o!.promotionInefficient).toBe(false);
  });
});

describe("deriveCrossSurfaceComparisonReadiness (Part 62)", () => {
  const paidCreated = new Date("2026-01-01T00:00:00.000Z");

  it("missing_timestamps when organic or paid snapshot time is absent", () => {
    expect(
      deriveCrossSurfaceComparisonReadiness({
        now: new Date("2026-02-15T12:00:00.000Z"),
        organicLatestFetchedAt: new Date("2026-02-14T10:00:00.000Z"),
        paidLatestFetchedAt: null,
        postPublishedAt: null,
        paidCreatedAt: paidCreated,
      })
    ).toEqual({ comparable: false, reason: "missing_timestamps" });
  });

  it("window_too_early when paid draft is under 24h old", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    expect(
      deriveCrossSurfaceComparisonReadiness({
        now,
        organicLatestFetchedAt: new Date("2026-01-01T06:00:00.000Z"),
        paidLatestFetchedAt: new Date("2026-01-01T08:00:00.000Z"),
        postPublishedAt: null,
        paidCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual({ comparable: false, reason: "window_too_early" });
  });

  it("window_too_early when latest paid snapshot is under 24h old", () => {
    const now = new Date("2026-02-15T12:00:00.000Z");
    expect(
      deriveCrossSurfaceComparisonReadiness({
        now,
        organicLatestFetchedAt: new Date("2026-02-14T10:00:00.000Z"),
        paidLatestFetchedAt: new Date("2026-02-15T02:00:00.000Z"),
        postPublishedAt: null,
        paidCreatedAt: new Date("2025-06-01T00:00:00.000Z"),
      })
    ).toEqual({ comparable: false, reason: "window_too_early" });
  });

  it("stale_organic when paid snapshot is 7d+ newer than organic", () => {
    expect(
      deriveCrossSurfaceComparisonReadiness({
        now: new Date("2026-03-01T12:00:00.000Z"),
        organicLatestFetchedAt: new Date("2026-02-01T10:00:00.000Z"),
        paidLatestFetchedAt: new Date("2026-02-10T10:00:00.000Z"),
        postPublishedAt: new Date("2025-12-01T10:00:00.000Z"),
        paidCreatedAt: new Date("2025-06-01T00:00:00.000Z"),
      })
    ).toEqual({ comparable: false, reason: "stale_organic" });
  });

  it("comparable true when snapshot gap is within 3d and anchors are sane", () => {
    expect(
      deriveCrossSurfaceComparisonReadiness({
        now: new Date("2026-02-20T12:00:00.000Z"),
        organicLatestFetchedAt: new Date("2026-02-14T10:00:00.000Z"),
        paidLatestFetchedAt: new Date("2026-02-14T16:00:00.000Z"),
        postPublishedAt: new Date("2025-12-01T10:00:00.000Z"),
        paidCreatedAt: paidCreated,
      })
    ).toEqual({ comparable: true });
  });
});
