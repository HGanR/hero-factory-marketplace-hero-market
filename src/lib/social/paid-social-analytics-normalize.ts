/**
 * Normalize Meta Marketing API insights rows for paid social snapshots (Part 50).
 * Only fields we can ground in the API response; omit fabricated metrics.
 */

export type PaidSocialNormalizedMetrics = {
  impressions: number | null;
  clicks: number | null;
  /** Spend in minor units (cents) when Meta returns currency amounts as decimal strings in account currency. */
  spendMinor: number | null;
  reach: number | null;
  cpcMinor: number | null;
  cpmMinor: number | null;
  ctr: number | null;
};

function parseMetaNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Meta often returns money as string "12.34" in account currency — store minor units (cents). */
function dollarsStringToMinor(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Normalize a single insights row from `/{ad-id}/insights` (lifetime or preset).
 */
export function normalizeMetaPaidInsightsRow(raw: Record<string, unknown>): PaidSocialNormalizedMetrics {
  const impressions = parseMetaNumber(raw.impressions);
  const clicks = parseMetaNumber(raw.clicks);
  const reach = parseMetaNumber(raw.reach);

  let spendMinor: number | null = null;
  const spendStr = raw.spend != null ? String(raw.spend) : "";
  spendMinor = dollarsStringToMinor(spendStr);

  let cpcMinor: number | null = null;
  const cpcStr = raw.cpc != null ? String(raw.cpc) : "";
  cpcMinor = dollarsStringToMinor(cpcStr);

  let cpmMinor: number | null = null;
  const cpmStr = raw.cpm != null ? String(raw.cpm) : "";
  cpmMinor = dollarsStringToMinor(cpmStr);

  const ctr = parseMetaNumber(raw.ctr);

  return {
    impressions,
    clicks,
    spendMinor,
    reach,
    cpcMinor,
    cpmMinor,
    ctr,
  };
}
