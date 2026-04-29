/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { derivePaidSyncHealth, formatPaidMetaSyncErrorSummary } from "@/lib/social/paid-social-campaign-sync-health";

describe("formatPaidMetaSyncErrorSummary", () => {
  it("summarizes auth errors", () => {
    expect(formatPaidMetaSyncErrorSummary({ hadAuth: true })).toMatch(/credentials|permissions/i);
  });

  it("summarizes throttle", () => {
    expect(formatPaidMetaSyncErrorSummary({ hadThrottle: true })).toMatch(/rate/i);
  });

  it("uses first phase error", () => {
    expect(
      formatPaidMetaSyncErrorSummary({
        errors: [{ phase: "insights_ad", message: "boom" }],
        partial: true,
      })
    ).toMatch(/insights ad/i);
  });
});

describe("derivePaidSyncHealth", () => {
  const base = {
    metaLaunchFeatureEnabled: true,
    paidLaunchLifecycle: "launched",
    remoteMetaCampaignId: "c1",
    lastMetaSyncAt: "2026-01-01T00:00:00.000Z",
    lastMetaSyncError: null,
    metaRuntimeStatus: "active",
    latestPaidMetrics: null as { impressions?: number | null } | null,
    latestSnapshotMeta: null as Record<string, unknown> | null,
  };

  it("labels never synced", () => {
    const h = derivePaidSyncHealth({ ...base, lastMetaSyncAt: null, remoteMetaCampaignId: "x" });
    expect(h.label).toMatch(/Never synced/i);
  });

  it("labels token issues", () => {
    const h = derivePaidSyncHealth({
      ...base,
      lastMetaSyncError: { hadAuth: true },
    });
    expect(h.label).toMatch(/Token/i);
  });

  it("labels partial metrics when fallback used", () => {
    const h = derivePaidSyncHealth({
      ...base,
      latestSnapshotMeta: { usedFallbackInsights: true, insightsSource: "adset" },
      latestPaidMetrics: { impressions: 1 },
    });
    expect(h.label).toMatch(/Partial metrics/i);
  });

  it("labels synced when ad-level metrics exist", () => {
    const h = derivePaidSyncHealth({
      ...base,
      latestSnapshotMeta: { insightsSource: "ad" },
      latestPaidMetrics: { impressions: 10 },
    });
    expect(h.label).toBe("Synced");
  });
});
