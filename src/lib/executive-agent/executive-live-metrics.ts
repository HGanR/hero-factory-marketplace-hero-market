/**
 * Live metrics payload for Executive Administration dashboards.
 * Numeric fields use `{ value, unavailable?, reason? }` so the UI never shows silent fakes.
 */

import type { SiteAnalyticsRollup } from "@/lib/analytics/site-analytics-store";

export type MetricValue<T> = {
  value: T | null;
  unavailable?: boolean;
  reason?: string;
  source?: "db" | "not_configured";
};

export type LiveTopPage = { path: string; visitors: number | null; unavailable?: boolean };

export type LiveTrafficSourceRow = {
  source: string;
  visitors: number;
  share: number;
  joinCommunityClicks: number;
  outboundPayPalClicks: number;
  potentialRevenue: number | null;
};

export type LiveTrafficAttribution = {
  unavailable: boolean;
  reason?: string;
  windowStart?: string;
  windowEnd?: string;
  landingPath?: string;
  items: LiveTrafficSourceRow[];
  landingPageVisitors: number | null;
  joinCommunityClicks: number | null;
  outboundPayPalClicks: number | null;
  joinCommunityConversionRate: number | null;
  paypalIntentRate: number | null;
  potentialRevenueTotal: number | null;
  communityPrice: number | null;
};

export type LiveMetricsResponse = {
  generatedAt: string;
  activeVisitors: MetricValue<number>;
  pageViews: MetricValue<number>;
  conversions: MetricValue<number>;
  topPages: { items: LiveTopPage[]; unavailable: boolean; reason?: string };
  trafficAttribution: LiveTrafficAttribution;
  pendingAccounts: MetricValue<number> & { pendingApprox30d?: number | null };
  approvedAccounts: MetricValue<number> & { approvedInactive?: number | null };
  activeAccounts: MetricValue<number>;
  campaignCounts: MetricValue<number>;
  engagement: MetricValue<number> & { unavailable?: boolean; message?: string };
  systemHealth: {
    database: "ok" | "unknown";
    apiServices: "ok" | "unknown";
    executiveReadTools: "ok" | "unknown";
  };
};

export type LiveMetricsDbSnapshot = {
  pendingAllTime: number | null;
  pendingApprox30d: number | null;
  approvedActive: number | null;
  approvedInactive: number | null;
  activeUsers: number | null;
  marketplaceUsers: number | null;
  crmClients: number | null;
  socialCampaigns: number | null;
  threadsLast7d: number | null;
  inboxUnavailable: boolean;
  inboxMessage?: string;
  /** When present, replaces stubbed analytics slots with real `site_analytics_events` rollups. */
  siteTraffic?: SiteAnalyticsRollup | null;
};

export function safeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function communityPriceForExecutiveRevenue(): number | null {
  const raw = process.env.NEXT_PUBLIC_COMMUNITY_PRICE?.trim();
  if (raw === "" || raw === "0" || raw?.toLowerCase() === "off") return null;
  if (raw == null) return 155;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildLiveMetricsResponse(snap: LiveMetricsDbSnapshot, generatedAt = new Date().toISOString()): LiveMetricsResponse {
  const st = snap.siteTraffic;
  const hasTraffic =
    st &&
    (st.landingPageVisitors > 0 ||
      st.pageViewsOnLanding > 0 ||
      st.joinCommunityClicks > 0 ||
      st.outboundPayPalClicks > 0 ||
      st.trafficBySource.length > 0);

  const price = communityPriceForExecutiveRevenue();
  const paypalClicks = st?.outboundPayPalClicks ?? 0;
  const potentialRevenueTotal = price == null ? null : paypalClicks * price;

  const landingVisitors = st?.landingPageVisitors ?? 0;
  const joinClicks = st?.joinCommunityClicks ?? 0;

  const trafficAttribution: LiveTrafficAttribution = hasTraffic
    ? {
        unavailable: false,
        windowStart: st!.windowStart,
        windowEnd: st!.windowEnd,
        landingPath: st!.landingPath,
        items: st!.trafficBySource.map((r) => ({
          source: r.source,
          visitors: r.visitors,
          share: r.share,
          joinCommunityClicks: r.joinCommunityClicks,
          outboundPayPalClicks: r.outboundPayPalClicks,
          potentialRevenue: r.potentialRevenue,
        })),
        landingPageVisitors: landingVisitors,
        joinCommunityClicks: joinClicks,
        outboundPayPalClicks: paypalClicks,
        joinCommunityConversionRate: safeRate(joinClicks, landingVisitors),
        paypalIntentRate: safeRate(paypalClicks, landingVisitors),
        potentialRevenueTotal,
        communityPrice: price,
      }
    : {
        unavailable: true,
        reason: "site_analytics_empty",
        items: [],
        landingPageVisitors: null,
        joinCommunityClicks: null,
        outboundPayPalClicks: null,
        joinCommunityConversionRate: null,
        paypalIntentRate: null,
        potentialRevenueTotal: null,
        communityPrice: price,
      };

  const topPagesFromEvents: LiveTopPage[] =
    hasTraffic && st!.topPaths.length
      ? st!.topPaths.map((p) => ({ path: p.path, visitors: p.visitors, unavailable: false }))
      : [];

  return {
    generatedAt,
    activeVisitors: hasTraffic
      ? {
          value: st!.landingPageVisitors,
          unavailable: false,
          source: "db",
        }
      : {
          value: null,
          unavailable: true,
          reason: "analytics_not_configured",
          source: "not_configured",
        },
    pageViews: hasTraffic
      ? {
          value: st!.pageViewsOnLanding,
          unavailable: false,
          source: "db",
        }
      : {
          value: null,
          unavailable: true,
          reason: "analytics_not_configured",
          source: "not_configured",
        },
    conversions: hasTraffic
      ? {
          value: st!.joinCommunityClicks,
          unavailable: false,
          source: "db",
        }
      : {
          value: null,
          unavailable: true,
          reason: "analytics_not_configured",
          source: "not_configured",
        },
    topPages: {
      items: topPagesFromEvents,
      unavailable: !hasTraffic || topPagesFromEvents.length === 0,
      reason: !hasTraffic || topPagesFromEvents.length === 0 ? "page_view_tables_not_configured" : undefined,
    },
    trafficAttribution,
    pendingAccounts: {
      value: snap.pendingAllTime,
      pendingApprox30d: snap.pendingApprox30d,
      unavailable: snap.pendingAllTime == null,
      source: "db",
    },
    approvedAccounts: {
      value: snap.approvedActive,
      approvedInactive: snap.approvedInactive,
      unavailable: snap.approvedActive == null,
      source: "db",
    },
    activeAccounts: {
      value: snap.activeUsers,
      unavailable: snap.activeUsers == null,
      source: "db",
    },
    campaignCounts: {
      value: snap.socialCampaigns,
      unavailable: snap.socialCampaigns == null,
      source: "db",
    },
    engagement: {
      value: snap.inboxUnavailable ? null : snap.threadsLast7d,
      unavailable: snap.inboxUnavailable,
      message: snap.inboxMessage,
      source: snap.inboxUnavailable ? "not_configured" : "db",
    },
    systemHealth: {
      database: "ok",
      apiServices: "ok",
      executiveReadTools: "ok",
    },
  };
}
