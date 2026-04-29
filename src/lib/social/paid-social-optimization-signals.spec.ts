/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  computePaidListSignalsSummary,
  dedupePaidOptimizationSignals,
  derivePaidOptimizationSignals,
  type PaidOptimizationSignal,
} from "@/lib/social/paid-social-optimization-signals";
import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";

const baseArgs = {
  paidLaunchLifecycle: "launched",
  metaLaunchStatus: "launched" as const,
  remoteMetaCampaignId: "c1",
  lastMetaSyncAt: "2026-01-01T00:00:00.000Z",
  metaRuntimeStatus: "paused" as string | null,
  latestPaidMetrics: null as PaidSocialNormalizedMetrics | null,
};

describe("derivePaidOptimizationSignals", () => {
  it("returns empty when not launched", () => {
    expect(
      derivePaidOptimizationSignals({
        ...baseArgs,
        paidLaunchLifecycle: "draft",
        metaLaunchStatus: "idle",
        remoteMetaCampaignId: null,
      })
    ).toHaveLength(0);
  });

  it("flags spend without clicks", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      latestPaidMetrics: { impressions: 100, clicks: 0, spendMinor: 50, reach: null, cpcMinor: null, cpmMinor: null, ctr: null },
    });
    expect(s.some((x) => x.code === "spend_without_clicks")).toBe(true);
  });

  it("flags low CTR when impressions sufficient", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      latestPaidMetrics: {
        impressions: 500,
        clicks: 1,
        spendMinor: null,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(s.some((x) => x.code === "low_ctr")).toBe(true);
  });

  it("no_impressions when not active runtime", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      metaRuntimeStatus: "paused",
      latestPaidMetrics: {
        impressions: 0,
        clicks: 0,
        spendMinor: 0,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(s.some((x) => x.code === "no_impressions_after_launch")).toBe(true);
  });

  it("active_but_no_delivery when active and zero impressions", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      metaRuntimeStatus: "active",
      latestPaidMetrics: {
        impressions: 0,
        clicks: 0,
        spendMinor: 0,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(s.some((x) => x.code === "active_but_no_delivery")).toBe(true);
  });

  it("no signals when metrics healthy", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      metaRuntimeStatus: "active",
      latestPaidMetrics: {
        impressions: 1000,
        clicks: 50,
        spendMinor: 100,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: 0.05,
      },
    });
    expect(s).toHaveLength(0);
  });

  it("suppresses low_ctr when spend_without_clicks applies", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      latestPaidMetrics: {
        impressions: 500,
        clicks: 0,
        spendMinor: 50,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(s.map((x) => x.code)).toEqual(["spend_without_clicks"]);
  });

  it("suppresses spend_without_clicks and low_ctr when no_impressions_after_launch applies", () => {
    const s = derivePaidOptimizationSignals({
      ...baseArgs,
      metaRuntimeStatus: "paused",
      latestPaidMetrics: {
        impressions: 0,
        clicks: 0,
        spendMinor: 25,
        reach: null,
        cpcMinor: null,
        cpmMinor: null,
        ctr: null,
      },
    });
    expect(s.map((x) => x.code)).toEqual(["no_impressions_after_launch"]);
  });

  it("respects threshold overrides for low_ctr", () => {
    const s = derivePaidOptimizationSignals(
      {
        ...baseArgs,
        latestPaidMetrics: {
          impressions: 500,
          clicks: 1,
          spendMinor: null,
          reach: null,
          cpcMinor: null,
          cpmMinor: null,
          ctr: null,
        },
      },
      { lowCtrThreshold: 0.0001 }
    );
    expect(s.some((x) => x.code === "low_ctr")).toBe(false);
  });
});

describe("dedupePaidOptimizationSignals", () => {
  const spend: PaidOptimizationSignal = {
    code: "spend_without_clicks",
    label: "Spend without clicks",
    hint: "h",
  };
  const low: PaidOptimizationSignal = {
    code: "low_ctr",
    label: "Very low CTR",
    hint: "h",
  };

  it("drops low_ctr when spend_without_clicks present", () => {
    expect(dedupePaidOptimizationSignals([low, spend]).map((x) => x.code)).toEqual(["spend_without_clicks"]);
  });
});

describe("computePaidListSignalsSummary", () => {
  it("aggregates top-priority label across drafts", () => {
    const s = computePaidListSignalsSummary([
      { paidOptimizationSignals: [{ code: "low_ctr", label: "Low", hint: "" }] },
      { paidOptimizationSignals: [{ code: "no_impressions_after_launch", label: "No imp", hint: "" }] },
    ]);
    expect(s.draftCountWithSignals).toBe(2);
    expect(s.topPrioritySignalLabel).toBe("No imp");
  });
});
