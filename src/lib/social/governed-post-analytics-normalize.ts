import type { PlatformPerformanceSnapshot } from "@/lib/social/platform-performance-sync-contract";
import type { NormalizedSocialPostMetrics, SocialPostAnalyticsSnapshotPayload } from "@/lib/social/governed-post-analytics-types";
import { SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION } from "@/lib/social/governed-post-analytics-types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Map a live adapter snapshot into normalized metrics + honest notes.
 * Keep provider-specific parsing in adapters; this layer only projects fields.
 */
export function normalizePlatformSnapshotToPayload(
  snapshot: PlatformPerformanceSnapshot
): SocialPostAnalyticsSnapshotPayload {
  const platform = String(snapshot.platform || "").toLowerCase();
  const sourceNotes: string[] = [];
  let comparatorCaveat: string | undefined;

  const normalized: NormalizedSocialPostMetrics = {};

  if (snapshot.impressions != null) normalized.impressions = snapshot.impressions;
  if (snapshot.reach != null) normalized.reach = snapshot.reach;
  if (snapshot.clicks != null) normalized.clicks = snapshot.clicks;
  if (snapshot.comments != null) normalized.comments = snapshot.comments;
  if (snapshot.shares != null) normalized.shares = snapshot.shares;
  if (snapshot.saves != null) normalized.saves = snapshot.saves;
  if (snapshot.videoViews != null) normalized.videoViews = snapshot.videoViews;

  if (snapshot.likes != null) {
    normalized.reactions = snapshot.likes;
  }

  if (snapshot.engagement != null) {
    normalized.engagementsTotal = snapshot.engagement;
  }

  if (platform === "instagram") {
    sourceNotes.push("Instagram: insights are lifetime where available; impressions may fall back to reach when Meta omits impressions.");
    if (normalized.impressions != null && normalized.reach != null && normalized.impressions === normalized.reach) {
      sourceNotes.push("Impressions equals reach in this snapshot — Meta may have only returned reach for this media.");
    }
    comparatorCaveat =
      "Instagram `engagementsTotal` may be a composite insight value; it is not directly comparable to LinkedIn’s likes+comments sum.";
  }

  if (platform === "linkedin") {
    sourceNotes.push(
      "LinkedIn: metrics come from `GET /rest/socialActions/{urn}` (likes + comments only). Impressions and reach are not available via this API path."
    );
    comparatorCaveat =
      "LinkedIn `engagementsTotal` is likes + comments from socialActions, not the same definition as Instagram’s engagement insight.";
  }

  return {
    version: SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION,
    normalized,
    platformSnapshot: snapshot,
    sourceNotes,
    comparatorCaveat,
  };
}

export function parseStoredAnalyticsPayload(raw: unknown): SocialPostAnalyticsSnapshotPayload | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION) return null;
  if (!isRecord(raw.normalized)) return null;
  if (!isRecord(raw.platformSnapshot)) return null;
  return raw as unknown as SocialPostAnalyticsSnapshotPayload;
}

/** Short planner row hint from the latest normalized metrics (published posts only). */
export function formatAnalyticsSummaryLine(args: {
  normalized: NormalizedSocialPostMetrics;
  fetchedAtIso: string;
}): string {
  const parts: string[] = [];
  const n = args.normalized;
  if (n.impressions != null) parts.push(`${n.impressions} impr`);
  if (n.reach != null && n.impressions == null) parts.push(`${n.reach} reach`);
  if (n.engagementsTotal != null) parts.push(`${n.engagementsTotal} eng`);
  else {
    if (n.reactions != null) parts.push(`${n.reactions} react`);
    if (n.comments != null) parts.push(`${n.comments} cmts`);
  }
  const head = parts.length ? parts.join(" · ") : "synced";
  const t = new Date(args.fetchedAtIso);
  const timeLabel = Number.isNaN(t.getTime()) ? args.fetchedAtIso : t.toLocaleString();
  return `Metrics: ${head} · synced ${timeLabel}`;
}
