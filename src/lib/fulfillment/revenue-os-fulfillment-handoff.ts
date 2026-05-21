/** Parses REVENUE_OS fulfillment handoff stored on client_service_orders.executiveHandoffJson. */

export type RevenueOsFulfillmentHandoff = {
  campaignId: string | null;
  intakeKind: string | null;
  revisionRound: number;
  launchReadinessApprovedAt: string | null;
  lastCampaignReviewApprovalId: string | null;
  lastLaunchReadinessApprovalId: string | null;
};

export function parseRevenueOsFulfillmentHandoff(json: string | null | undefined): RevenueOsFulfillmentHandoff {
  const empty: RevenueOsFulfillmentHandoff = {
    campaignId: null,
    intakeKind: null,
    revisionRound: 0,
    launchReadinessApprovedAt: null,
    lastCampaignReviewApprovalId: null,
    lastLaunchReadinessApprovalId: null,
  };
  if (!json?.trim()) return empty;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    return {
      campaignId: typeof v.campaignId === "string" && v.campaignId.trim() ? v.campaignId.trim() : null,
      intakeKind: typeof v.intakeKind === "string" ? v.intakeKind : null,
      revisionRound: typeof v.revisionRound === "number" && Number.isFinite(v.revisionRound) ? v.revisionRound : 0,
      launchReadinessApprovedAt:
        typeof v.launchReadinessApprovedAt === "string" ? v.launchReadinessApprovedAt : null,
      lastCampaignReviewApprovalId:
        typeof v.lastCampaignReviewApprovalId === "string" ? v.lastCampaignReviewApprovalId : null,
      lastLaunchReadinessApprovalId:
        typeof v.lastLaunchReadinessApprovalId === "string" ? v.lastLaunchReadinessApprovalId : null,
    };
  } catch {
    return empty;
  }
}

export function mergeRevenueOsFulfillmentHandoff(
  current: string | null | undefined,
  patch: Partial<RevenueOsFulfillmentHandoff>
): string {
  const base = parseRevenueOsFulfillmentHandoff(current);
  return JSON.stringify({ ...base, ...patch }).slice(0, 50_000);
}
