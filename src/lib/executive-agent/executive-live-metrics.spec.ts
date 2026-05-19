import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLiveMetricsResponse, safeRate, type LiveMetricsDbSnapshot } from "@/lib/executive-agent/executive-live-metrics";

describe("executive-live-metrics", () => {
  it("returns stable API shape with unavailable analytics slots", () => {
    const snap: LiveMetricsDbSnapshot = {
      pendingAllTime: 3,
      pendingApprox30d: 2,
      approvedActive: 10,
      approvedInactive: 1,
      activeUsers: 44,
      marketplaceUsers: 100,
      crmClients: 20,
      socialCampaigns: 5,
      threadsLast7d: 8,
      inboxUnavailable: false,
    };
    const m = buildLiveMetricsResponse(snap, "2026-01-01T00:00:00.000Z");
    assert.equal(m.generatedAt, "2026-01-01T00:00:00.000Z");
    assert.equal(m.activeVisitors.unavailable, true);
    assert.equal(m.pageViews.unavailable, true);
    assert.equal(m.topPages.unavailable, true);
    assert.equal(m.trafficAttribution.unavailable, true);
    assert.equal(m.pendingAccounts.value, 3);
    assert.equal(m.engagement.value, 8);
    assert.equal(m.systemHealth.database, "ok");
  });

  it("computes conversion rates when site traffic rollup is present", () => {
    const snap: LiveMetricsDbSnapshot = {
      pendingAllTime: 0,
      pendingApprox30d: 0,
      approvedActive: 0,
      approvedInactive: 0,
      activeUsers: 0,
      marketplaceUsers: 0,
      crmClients: 0,
      socialCampaigns: 0,
      threadsLast7d: 0,
      inboxUnavailable: false,
      siteTraffic: {
        windowStart: "a",
        windowEnd: "b",
        landingPath: "/",
        landingPageVisitors: 100,
        joinCommunityClicks: 10,
        outboundPayPalClicks: 4,
        pageViewsOnLanding: 200,
        trafficBySource: [
          {
            source: "direct",
            visitors: 80,
            share: 0.8,
            joinCommunityClicks: 8,
            outboundPayPalClicks: 3,
            potentialRevenue: 3 * 155,
          },
        ],
        topPaths: [{ path: "/", visitors: 100 }],
      },
    };
    const m = buildLiveMetricsResponse(snap);
    assert.equal(m.activeVisitors.unavailable, false);
    assert.equal(m.activeVisitors.value, 100);
    assert.equal(m.trafficAttribution.joinCommunityConversionRate, safeRate(10, 100));
    assert.equal(m.trafficAttribution.paypalIntentRate, safeRate(4, 100));
    assert.equal(m.trafficAttribution.potentialRevenueTotal, 4 * 155);
  });

  it("marks engagement unavailable when inbox snapshot says so", () => {
    const snap: LiveMetricsDbSnapshot = {
      pendingAllTime: 0,
      pendingApprox30d: 0,
      approvedActive: 0,
      approvedInactive: 0,
      activeUsers: 0,
      marketplaceUsers: 0,
      crmClients: 0,
      socialCampaigns: 0,
      threadsLast7d: null,
      inboxUnavailable: true,
      inboxMessage: "no table",
    };
    const m = buildLiveMetricsResponse(snap);
    assert.equal(m.engagement.unavailable, true);
    assert.equal(m.engagement.value, null);
  });
});
