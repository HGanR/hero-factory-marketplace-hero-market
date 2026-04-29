/**
 * Merge capital plan budgetAllocation with channel_spend_snapshots for plan-vs-actuals UI.
 */

export type BudgetAllocationRow = {
  channel: string;
  pct: number;
  spend: number;
};

export type ChannelComparisonRow = {
  channel: string;
  plannedSpend: number;
  plannedPct: number;
  actualSpend: number;
  revenueAttributed: number | null;
  roas: number | null;
  varianceVsPlan: number;
  spendStatus: "overspend" | "underspend" | "on_plan";
  performanceStatus: "underperforming" | "ok" | "unknown";
};

function num(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "") return Number(x);
  return 0;
}

export function extractBudgetAllocation(
  payload: Record<string, unknown> | null | undefined
): BudgetAllocationRow[] {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload.budgetAllocation;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const channel = typeof o.channel === "string" ? o.channel : "";
      if (!channel) return null;
      return {
        channel,
        pct: num(o.pct),
        spend: num(o.spend),
      };
    })
    .filter((x): x is BudgetAllocationRow => x !== null);
}

export function buildChannelComparisons(
  planned: BudgetAllocationRow[],
  actuals: Array<{
    channel: string;
    spend: number;
    revenueAttributed: number | null;
    roas: number | null;
  }>,
  options?: { overspendThreshold?: number; roasUnderperform?: number }
): ChannelComparisonRow[] {
  const overT = options?.overspendThreshold ?? 0.1;
  const roasBad = options?.roasUnderperform ?? 1;

  const actualBy = new Map(actuals.map((a) => [a.channel.toLowerCase(), a]));
  const planBy = new Map(planned.map((p) => [p.channel.toLowerCase(), p]));

  const keys = new Set<string>([...planBy.keys(), ...actualBy.keys()]);
  const maxRoas = Math.max(
    0,
    ...actuals.map((a) => (a.roas != null && Number.isFinite(a.roas) ? a.roas : 0))
  );

  const rows: ChannelComparisonRow[] = [];
  for (const lk of keys) {
    const pl = planBy.get(lk);
    const ac = actualBy.get(lk);
    const channel = pl?.channel ?? ac?.channel ?? lk;
    const plannedSpend = pl?.spend ?? 0;
    const plannedPct = pl?.pct ?? 0;
    const actualSpend = ac?.spend ?? 0;
    const revenueAttributed = ac?.revenueAttributed ?? null;
    let roas = ac?.roas ?? null;
    if (roas == null && revenueAttributed != null && actualSpend > 0) {
      roas = revenueAttributed / actualSpend;
    }

    const varianceVsPlan =
      plannedSpend > 0 ? (actualSpend - plannedSpend) / plannedSpend : actualSpend > 0 ? 1 : 0;

    let spendStatus: ChannelComparisonRow["spendStatus"] = "on_plan";
    if (plannedSpend <= 0 && actualSpend <= 0) spendStatus = "on_plan";
    else if (plannedSpend <= 0 && actualSpend > 0) spendStatus = "overspend";
    else if (varianceVsPlan > overT) spendStatus = "overspend";
    else if (varianceVsPlan < -overT) spendStatus = "underspend";

    let performanceStatus: ChannelComparisonRow["performanceStatus"] = "unknown";
    if (roas != null && Number.isFinite(roas)) {
      performanceStatus = roas < roasBad ? "underperforming" : "ok";
      if (maxRoas >= roasBad && roas < maxRoas * 0.5) {
        performanceStatus = "underperforming";
      }
    }

    rows.push({
      channel,
      plannedSpend,
      plannedPct,
      actualSpend,
      revenueAttributed,
      roas,
      varianceVsPlan,
      spendStatus,
      performanceStatus,
    });
  }

  rows.sort((a, b) => b.plannedSpend + b.actualSpend - (a.plannedSpend + a.actualSpend));
  return rows;
}
