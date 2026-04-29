/**
 * Basic winner selection from variant metric snapshots (revenue proxy).
 */

export type VariantMetricSnapshot = {
  traffic: number;
  conversionRatePct: number;
  avgOrderValue: number;
  cac: number;
  revenue: number;
};

export function revenueFromSnapshot(m: VariantMetricSnapshot): number {
  if (m.revenue > 0) return m.revenue;
  return m.traffic * (m.conversionRatePct / 100) * m.avgOrderValue;
}

export function pickWinnerVariantId(
  variants: { id: string; isControl: boolean }[],
  metricsByVariantId: Map<string, VariantMetricSnapshot>
): { winnerVariantId: string; controlId: string | null; lifts: Record<string, number> } {
  let controlId: string | null = null;
  for (const v of variants) {
    if (v.isControl) controlId = v.id;
  }
  const controlSnap = controlId ? metricsByVariantId.get(controlId) : undefined;
  const controlRev = controlSnap ? revenueFromSnapshot(controlSnap) : 0;

  const lifts: Record<string, number> = {};
  let bestId = "";
  let bestRev = -Infinity;

  for (const v of variants) {
    const snap = metricsByVariantId.get(v.id);
    if (!snap) continue;
    const rev = revenueFromSnapshot(snap);
    if (rev > bestRev) {
      bestRev = rev;
      bestId = v.id;
    }
    if (controlRev > 0) {
      lifts[v.id] = Math.round(((rev - controlRev) / controlRev) * 10_000) / 100;
    } else {
      lifts[v.id] = 0;
    }
  }

  return { winnerVariantId: bestId || variants[0]?.id || "", controlId, lifts };
}
