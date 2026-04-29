/**
 * Pure conversion analytics from tracked lead rows (Phase 4E).
 */

export type TrackedLeadForAnalytics = {
  id: string;
  platform: string;
  status: string;
  source: string;
  painType: string;
  intentScore: string;
  commercialReadiness: string | null;
  contentDeploymentId: string | null;
  analysisRunId: string | null;
  uploadId: string | null;
  estimatedValue: string | null;
  closedValue: string | null;
  attributionSnapshotJson: Record<string, unknown> | null;
  createdAt: Date | string;
};

export type DimensionBreakdown = {
  key: string;
  total: number;
  contacted: number;
  booked: number;
  closed: number;
  lost: number;
  estimatedPipeline: number;
  closedRevenue: number;
  bookedRate: number;
  closeRate: number;
};

export type ConversionSummary = {
  total: number;
  contacted: number;
  booked: number;
  closed: number;
  lost: number;
  newCount: number;
  contactedRate: number;
  bookedRate: number;
  closeRate: number;
  lostRate: number;
  totalEstimatedPipeline: number;
  totalClosedRevenue: number;
  byPlatform: DimensionBreakdown[];
  bySource: DimensionBreakdown[];
  byPainType: DimensionBreakdown[];
  byCommercialReadiness: DimensionBreakdown[];
  byDeployment: DimensionBreakdown[];
  byCtaAngle: DimensionBreakdown[];
  byOfferAngle: DimensionBreakdown[];
  byHookTheme: DimensionBreakdown[];
};

function parseMoney(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function isContacted(s: string): boolean {
  return s !== "new";
}

function isBooked(s: string): boolean {
  return s === "booked" || s === "closed";
}

function isClosed(s: string): boolean {
  return s === "closed";
}

function isLost(s: string): boolean {
  return s === "lost";
}

function emptyDim(key: string): DimensionBreakdown {
  return {
    key,
    total: 0,
    contacted: 0,
    booked: 0,
    closed: 0,
    lost: 0,
    estimatedPipeline: 0,
    closedRevenue: 0,
    bookedRate: 0,
    closeRate: 0,
  };
}

function bumpDim(
  map: Map<string, DimensionBreakdown>,
  key: string,
  row: TrackedLeadForAnalytics
): void {
  const k = key || "(unknown)";
  let d = map.get(k);
  if (!d) {
    d = emptyDim(k);
    map.set(k, d);
  }
  d.total += 1;
  if (isContacted(row.status)) d.contacted += 1;
  if (isBooked(row.status)) d.booked += 1;
  if (isClosed(row.status)) d.closed += 1;
  if (isLost(row.status)) d.lost += 1;
  d.estimatedPipeline += parseMoney(row.estimatedValue);
  d.closedRevenue += parseMoney(row.closedValue);
}

function finalizeDimensions(map: Map<string, DimensionBreakdown>): DimensionBreakdown[] {
  const out: DimensionBreakdown[] = [];
  for (const d of map.values()) {
    d.bookedRate = d.total > 0 ? d.booked / d.total : 0;
    d.closeRate = d.total > 0 ? d.closed / d.total : 0;
    out.push(d);
  }
  return out.sort((a, b) => b.booked - a.booked || b.total - a.total);
}

function snapStr(s: Record<string, unknown> | null, k: string): string {
  if (!s) return "";
  const v = s[k];
  return typeof v === "string" ? v.slice(0, 256) : "";
}

export function computeConversionSummary(rows: TrackedLeadForAnalytics[]): ConversionSummary {
  let total = 0;
  let contacted = 0;
  let booked = 0;
  let closed = 0;
  let lost = 0;
  let newCount = 0;
  let totalEstimatedPipeline = 0;
  let totalClosedRevenue = 0;

  const byPlatform = new Map<string, DimensionBreakdown>();
  const bySource = new Map<string, DimensionBreakdown>();
  const byPain = new Map<string, DimensionBreakdown>();
  const byReadiness = new Map<string, DimensionBreakdown>();
  const byDeploy = new Map<string, DimensionBreakdown>();
  const byCta = new Map<string, DimensionBreakdown>();
  const byOffer = new Map<string, DimensionBreakdown>();
  const byHook = new Map<string, DimensionBreakdown>();

  for (const row of rows) {
    total++;
    if (row.status === "new") newCount++;
    if (isContacted(row.status)) contacted++;
    if (isBooked(row.status)) booked++;
    if (isClosed(row.status)) closed++;
    if (isLost(row.status)) lost++;
    totalEstimatedPipeline += parseMoney(row.estimatedValue);
    totalClosedRevenue += parseMoney(row.closedValue);

    bumpDim(byPlatform, row.platform, row);
    bumpDim(bySource, row.source, row);
    bumpDim(byPain, row.painType || "(none)", row);
    bumpDim(byReadiness, row.commercialReadiness || "(unknown)", row);

    const dep = row.contentDeploymentId?.trim();
    if (dep) bumpDim(byDeploy, dep, row);
    else bumpDim(byDeploy, "(no deployment)", row);

    const snap = row.attributionSnapshotJson;
    const cta = snapStr(snap, "suggestedCtaAngle") || snapStr(snap, "suggestedCommentAngle") || "(no CTA snapshot)";
    const offer = snapStr(snap, "bestOfferAngle") || "(no offer snapshot)";
    const hook = snapStr(snap, "hookSnapshot") || snapStr(snap, "painTheme") || "(no hook/theme)";
    bumpDim(byCta, cta.slice(0, 120), row);
    bumpDim(byOffer, offer.slice(0, 160), row);
    bumpDim(byHook, hook.slice(0, 120), row);
  }

  return {
    total,
    contacted,
    booked,
    closed,
    lost,
    newCount,
    contactedRate: total > 0 ? contacted / total : 0,
    bookedRate: total > 0 ? booked / total : 0,
    closeRate: total > 0 ? closed / total : 0,
    lostRate: total > 0 ? lost / total : 0,
    totalEstimatedPipeline,
    totalClosedRevenue,
    byPlatform: finalizeDimensions(byPlatform),
    bySource: finalizeDimensions(bySource),
    byPainType: finalizeDimensions(byPain),
    byCommercialReadiness: finalizeDimensions(byReadiness),
    byDeployment: finalizeDimensions(byDeploy),
    byCtaAngle: finalizeDimensions(byCta),
    byOfferAngle: finalizeDimensions(byOffer),
    byHookTheme: finalizeDimensions(byHook),
  };
}
