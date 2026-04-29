/**
 * Instagram Graph API — insights for a published media id (numeric ig-media id).
 * https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 */

import type {
  PlatformPerformanceSnapshot,
  PlatformPostPerformanceFetchStatus,
} from "@/lib/social/platform-performance-sync-contract";

type IgErrorBody = { error?: { message?: string; code?: number; type?: string; error_subcode?: number } };

function graphErrorMessage(context: string, body: IgErrorBody | null): string {
  const m = body?.error?.message?.trim();
  const code = body?.error?.code;
  const sub = body?.error?.error_subcode;
  const bits = [m || "Unknown Graph API error"];
  if (code != null) bits.push(`code=${code}`);
  if (sub != null) bits.push(`subcode=${sub}`);
  return `${context}: ${bits.join(" · ")}`;
}

function pickInsight(
  data: Array<{ name?: string; values?: Array<{ value?: number }> }> | undefined,
  name: string
): number | null {
  const row = data?.find((d) => d.name === name);
  const v = row?.values?.[0]?.value;
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/**
 * Fetch real IG media metrics. Returns `error` (not throw) for missing permissions, wrong id shape, or empty metrics.
 */
export async function fetchInstagramPostPerformanceSnapshot(args: {
  accessToken: string;
  externalPostId: string;
  fetchImpl?: typeof fetch;
}): Promise<PlatformPostPerformanceFetchStatus> {
  const fetchFn = args.fetchImpl ?? fetch;
  const id = args.externalPostId.trim();
  if (!/^\d+$/.test(id)) {
    return {
      status: "error",
      message:
        "Instagram metric sync expects a numeric Graph media id in platform_post_id (from media_publish). Re-publish or check stored id.",
    };
  }

  const token = args.accessToken.trim();
  if (!token) {
    return { status: "error", message: "Instagram metric sync: missing access token." };
  }

  const base = "https://graph.facebook.com/v21.0";
  const fieldsUrl = `${base}/${encodeURIComponent(id)}?fields=like_count,comments_count,media_product_type&access_token=${encodeURIComponent(token)}`;

  let mediaJson: IgErrorBody & {
    like_count?: number;
    comments_count?: number;
    media_product_type?: string;
  };
  try {
    const res = await fetchFn(fieldsUrl);
    mediaJson = (await res.json()) as typeof mediaJson;
    if (!res.ok || mediaJson.error) {
      return { status: "error", message: graphErrorMessage("Instagram media fields", mediaJson) };
    }
  } catch (e) {
    return {
      status: "error",
      message: `Instagram media fields request failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const metricSets = [
    "impressions,reach,saved,engagement,video_views",
    "reach,saved,engagement",
    "reach,saved",
    "engagement",
  ];

  let insightsJson: IgErrorBody & { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> } = {};
  let lastInsightsError: string | null = null;

  for (const metric of metricSets) {
    const url = `${base}/${encodeURIComponent(id)}/insights?metric=${encodeURIComponent(metric)}&period=lifetime&access_token=${encodeURIComponent(token)}`;
    try {
      const res = await fetchFn(url);
      insightsJson = (await res.json()) as typeof insightsJson;
      if (res.ok && !insightsJson.error && Array.isArray(insightsJson.data) && insightsJson.data.length > 0) {
        break;
      }
      if (insightsJson.error) {
        lastInsightsError = graphErrorMessage("Instagram insights", insightsJson);
      }
    } catch (e) {
      lastInsightsError = `Instagram insights request failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const data = insightsJson.data;
  const impressionsMetric = pickInsight(data, "impressions");
  const reach = pickInsight(data, "reach");
  const saved = pickInsight(data, "saved");
  const engagementMetric = pickInsight(data, "engagement");
  const videoViews = pickInsight(data, "video_views");

  const likes = typeof mediaJson.like_count === "number" ? mediaJson.like_count : null;
  const comments = typeof mediaJson.comments_count === "number" ? mediaJson.comments_count : null;

  let engagement = engagementMetric;
  if (engagement == null) {
    const parts = [likes, comments, saved].filter((x): x is number => typeof x === "number");
    if (parts.length) engagement = parts.reduce((a, b) => a + b, 0);
  }

  /** Prefer reported impressions; when Meta omits impressions but returns reach, use reach as visibility proxy (documented). */
  const impressions = impressionsMetric ?? reach ?? null;

  const hasAny =
    impressions != null ||
    reach != null ||
    saved != null ||
    likes != null ||
    comments != null ||
    videoViews != null ||
    engagement != null;

  if (!hasAny) {
    if (lastInsightsError) {
      return {
        status: "error",
        message: `${lastInsightsError} (If this mentions permissions, reconnect Instagram with insights scope or wait for metrics to populate.)`,
      };
    }
    return {
      status: "error",
      message:
        "Instagram returned no usable metrics for this media yet (too new, wrong id, or insights not permitted for this token).",
    };
  }

  const capturedAt = new Date().toISOString();
  const snapshot: PlatformPerformanceSnapshot = {
    platform: "instagram",
    externalPostId: id,
    capturedAt,
    impressions,
    reach,
    clicks: null,
    engagement,
    likes,
    comments,
    shares: null,
    saves: saved,
    leads: null,
    videoViews,
    ctr: null,
    cpc: null,
  };

  return { status: "ok", snapshot };
}
