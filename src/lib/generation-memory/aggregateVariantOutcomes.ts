export type VariantOutcomeRollup = {
  variantId: string;
  variantTag: string;
  deploymentIds: string[];
  trackedLeadCount: number;
  bookedOrClosed: number;
  bookedOnlyCount: number;
  closedCount: number;
  estimatedPipeline: number;
  closedRevenue: number;
};

type VariantRow = { id: string; variantTag: string };
type DeploymentRow = { id: string; generationVariantId: string | null };
type LeadRow = {
  contentDeploymentId: string | null;
  status: string;
  estimatedValue: string | null;
  closedValue: string | null;
};

function money(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normStatus(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Deterministic rollups for experiment variants from deployments + tracked leads.
 */
export function aggregateVariantOutcomes(input: {
  variants: VariantRow[];
  deployments: DeploymentRow[];
  leads: LeadRow[];
}): VariantOutcomeRollup[] {
  const deployByVariant = new Map<string, string[]>();
  for (const d of input.deployments) {
    const vid = d.generationVariantId;
    if (!vid) continue;
    const cur = deployByVariant.get(vid) ?? [];
    cur.push(d.id);
    deployByVariant.set(vid, cur);
  }

  const deploymentToVariant = new Map<string, string>();
  for (const d of input.deployments) {
    if (d.generationVariantId) deploymentToVariant.set(d.id, d.generationVariantId);
  }

  const out: VariantOutcomeRollup[] = [];

  for (const v of input.variants) {
    const depIds = deployByVariant.get(v.id) ?? [];
    const leadsForVariant = input.leads.filter((l) => {
      const dep = l.contentDeploymentId;
      if (!dep) return false;
      return deploymentToVariant.get(dep) === v.id;
    });

    let bookedOnlyCount = 0;
    let closedCount = 0;
    let bookedOrClosed = 0;
    let estimatedPipeline = 0;
    let closedRevenue = 0;

    for (const l of leadsForVariant) {
      const st = normStatus(l.status);
      if (st === "closed") {
        closedCount += 1;
        bookedOrClosed += 1;
        closedRevenue += money(l.closedValue);
        continue;
      }
      if (st === "booked") {
        bookedOnlyCount += 1;
        bookedOrClosed += 1;
        continue;
      }
      if (st !== "lost" && st !== "closed") {
        estimatedPipeline += money(l.estimatedValue);
      }
    }

    out.push({
      variantId: v.id,
      variantTag: v.variantTag,
      deploymentIds: depIds,
      trackedLeadCount: leadsForVariant.length,
      bookedOrClosed,
      bookedOnlyCount,
      closedCount,
      estimatedPipeline,
      closedRevenue,
    });
  }

  return out;
}
