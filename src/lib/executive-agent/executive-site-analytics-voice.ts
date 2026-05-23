import type { LiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";

export type SiteAnalyticsVoiceSnapshot = {
  activeVisitors: number | null;
  pageViews: number | null;
  conversions: number | null;
  bounceRate: number | null;
  unavailable: boolean;
};

export function buildSiteAnalyticsVoiceAnswer(snap: SiteAnalyticsVoiceSnapshot): string {
  if (snap.unavailable) {
    return "Site analytics aren't available yet, Boss — no traffic data has been recorded for the current window.";
  }

  const parts: string[] = [];

  if (snap.activeVisitors != null) {
    parts.push(`${snap.activeVisitors} active visitor${snap.activeVisitors === 1 ? "" : "s"}`);
  } else {
    parts.push("active visitors unavailable");
  }

  if (snap.pageViews != null) {
    parts.push(`${snap.pageViews} page view${snap.pageViews === 1 ? "" : "s"}`);
  }

  if (snap.conversions != null) {
    parts.push(`${snap.conversions} conversion${snap.conversions === 1 ? "" : "s"}`);
  }

  if (snap.bounceRate != null) {
    parts.push(`single-page visit rate ${(snap.bounceRate * 100).toFixed(1)}%`);
  }

  return `Here's the site picture — ${parts.join(", ")}.`;
}

export function siteAnalyticsVoiceSnapshotFromLiveMetrics(
  metrics: Pick<LiveMetricsResponse, "activeVisitors" | "pageViews" | "conversions" | "bounceRate">,
): SiteAnalyticsVoiceSnapshot {
  const unavailable =
    metrics.activeVisitors.unavailable &&
    metrics.pageViews.unavailable &&
    metrics.conversions.unavailable;

  return {
    activeVisitors: metrics.activeVisitors.unavailable ? null : metrics.activeVisitors.value,
    pageViews: metrics.pageViews.unavailable ? null : metrics.pageViews.value,
    conversions: metrics.conversions.unavailable ? null : metrics.conversions.value,
    bounceRate: metrics.bounceRate.unavailable ? null : metrics.bounceRate.value,
    unavailable,
  };
}
