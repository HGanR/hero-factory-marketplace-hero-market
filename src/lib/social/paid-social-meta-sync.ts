/**
 * Meta Marketing API read path for paid campaign sync (Parts 50–51).
 */

import { MetaMarketingApiError, metaGraphGet } from "@/lib/social/paid-social-meta-marketing-api";

export type MetaSyncFailureKind = "throttled" | "auth" | "network" | "unknown";

export function classifyMetaSyncFailure(err: unknown): { kind: MetaSyncFailureKind } {
  if (err instanceof MetaMarketingApiError) {
    const code = err.metaCode;
    if (code === 4 || code === 17) return { kind: "throttled" };
    if (code === 190 || code === 102) return { kind: "auth" };
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("oauth") || msg.includes("token")) return { kind: "auth" };
  if (msg.includes("socket") || msg.includes("network") || msg.includes("econnreset")) return { kind: "network" };
  return { kind: "unknown" };
}

type Phase = "campaign" | "adset" | "ad" | "insights_ad" | "insights_adset" | "insights_campaign";

export type MetaPaidSyncPhaseError = {
  phase: Phase;
  message: string;
  kind: MetaSyncFailureKind;
};

export type MetaPaidNormalizedMetrics = {
  impressions: number | null;
  clicks: number | null;
  spendMinor: number | null;
  reach: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
};

export type MetaPaidCampaignBundle = {
  campaign: Record<string, unknown> | null;
  adset: Record<string, unknown> | null;
  ad: Record<string, unknown> | null;
  insights: Record<string, unknown> | null;
  normalizedMetrics: MetaPaidNormalizedMetrics | null;
  runtimeStatus: string | null;
  errors: MetaPaidSyncPhaseError[];
  insightsSource: "ad" | "adset" | "campaign" | null;
  metricsCompleteness: "full" | "partial_early_delivery" | "none";
  sourceNotes: string[];
};

function effStatus(obj: Record<string, unknown> | null): string {
  const s = (obj?.effective_status ?? obj?.status ?? "") as string;
  return String(s || "").toLowerCase();
}

function parseInsightsRow(row: Record<string, unknown>): MetaPaidNormalizedMetrics | null {
  const num = (k: string) => {
    const v = row[k];
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const impressions = num("impressions");
  const clicks = num("clicks");
  const reach = num("reach");
  const spendStr = row.spend != null ? String(row.spend) : "";
  const spendDollars = spendStr ? Number.parseFloat(spendStr) : NaN;
  const spendMinor = Number.isFinite(spendDollars) ? Math.round(spendDollars * 100) : null;
  const cpc = num("cpc");
  const cpm = num("cpm");
  const ctr = num("ctr");
  if (
    impressions == null &&
    clicks == null &&
    spendMinor == null &&
    reach == null
  ) {
    return null;
  }
  return { impressions, clicks, spendMinor, reach, cpc, cpm, ctr };
}

async function safeGet(
  path: string,
  token: string,
  phase: Phase
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; err: MetaPaidSyncPhaseError }> {
  try {
    const json = await metaGraphGet(path, token);
    return { ok: true, json };
  } catch (e) {
    const c = classifyMetaSyncFailure(e);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      err: { phase, message: msg.slice(0, 500), kind: c.kind === "unknown" ? "network" : c.kind },
    };
  }
}

function pickInsightsData(json: Record<string, unknown>): Record<string, unknown>[] {
  const data = json.data;
  if (!Array.isArray(data)) return [];
  return data.filter((x): x is Record<string, unknown> => x != null && typeof x === "object") as Record<
    string,
    unknown
  >[];
}

export async function readMetaPaidCampaignBundle(
  accessToken: string,
  ids: {
    remoteCampaignId: string | null;
    remoteAdsetId: string | null;
    remoteAdId: string | null;
  }
): Promise<MetaPaidCampaignBundle> {
  const errors: MetaPaidSyncPhaseError[] = [];
  const sourceNotes: string[] = [];
  let campaign: Record<string, unknown> | null = null;
  let adset: Record<string, unknown> | null = null;
  let ad: Record<string, unknown> | null = null;

  if (ids.remoteCampaignId?.trim()) {
    const r = await safeGet(`${ids.remoteCampaignId.trim()}?fields=name,status,effective_status`, accessToken, "campaign");
    if (r.ok) campaign = r.json;
    else errors.push(r.err);
  }
  if (ids.remoteAdsetId?.trim()) {
    const r = await safeGet(`${ids.remoteAdsetId.trim()}?fields=name,status,effective_status`, accessToken, "adset");
    if (r.ok) adset = r.json;
    else errors.push(r.err);
  }
  if (ids.remoteAdId?.trim()) {
    const r = await safeGet(`${ids.remoteAdId.trim()}?fields=name,status,effective_status`, accessToken, "ad");
    if (r.ok) ad = r.json;
    else errors.push(r.err);
  }

  const fields =
    "impressions,clicks,spend,reach,cpc,cpm,ctr,actions,action_values,video_p25_watched_actions";

  let insights: Record<string, unknown> | null = null;
  let normalizedMetrics: MetaPaidNormalizedMetrics | null = null;
  let insightsSource: MetaPaidCampaignBundle["insightsSource"] = null;
  let metricsCompleteness: MetaPaidCampaignBundle["metricsCompleteness"] = "none";

  const tryInsights = async (
    nodeId: string,
    phase: Phase,
    label: MetaPaidCampaignBundle["insightsSource"]
  ): Promise<MetaPaidNormalizedMetrics | null> => {
    try {
      const j = await metaGraphGet(`${nodeId}/insights`, accessToken, {
        fields,
        date_preset: "lifetime",
      });
      insights = j;
      const rows = pickInsightsData(j);
      if (!rows.length) return null;
      const m = parseInsightsRow(rows[0]!);
      if (m) {
        insightsSource = label;
        return m;
      }
      return null;
    } catch (e) {
      const c = classifyMetaSyncFailure(e);
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({
        phase,
        message: msg.slice(0, 500),
        kind: c.kind === "unknown" ? "network" : c.kind,
      });
      if (c.kind === "throttled") {
        return null;
      }
      return null;
    }
  };

  if (ids.remoteAdId?.trim()) {
    const m = await tryInsights(ids.remoteAdId.trim(), "insights_ad", "ad");
    if (m) {
      normalizedMetrics = m;
      metricsCompleteness = "full";
    } else if (!errors.some((e) => e.phase === "insights_ad" && e.kind === "throttled")) {
      if (ids.remoteAdsetId?.trim()) {
        const m2 = await tryInsights(ids.remoteAdsetId.trim(), "insights_adset", "adset");
        if (m2) {
          normalizedMetrics = m2;
          metricsCompleteness = "partial_early_delivery";
          sourceNotes.push("Used ad set insights fallback (ad-level insights empty or unavailable).");
        }
      }
      if (!normalizedMetrics && ids.remoteCampaignId?.trim()) {
        const m3 = await tryInsights(ids.remoteCampaignId.trim(), "insights_campaign", "campaign");
        if (m3) {
          normalizedMetrics = m3;
          metricsCompleteness = "partial_early_delivery";
          sourceNotes.push("Used campaign insights fallback.");
        }
      }
    }
  }

  const adEff = effStatus(ad);
  const asEff = effStatus(adset);
  const cEff = effStatus(campaign);
  const runtimeStatus =
    adEff || asEff || cEff || (normalizedMetrics ? "active" : null);

  return {
    campaign,
    adset,
    ad,
    insights,
    normalizedMetrics,
    runtimeStatus,
    errors,
    insightsSource,
    metricsCompleteness,
    sourceNotes,
  };
}
