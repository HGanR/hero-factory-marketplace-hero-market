/**
 * Optional structured logging for paid draft list projection (Part 55).
 * Enable with PAID_SOCIAL_LIST_PROJECTION_LOG=1 or true (case-insensitive).
 */

export type PaidListProjectionLogPayload = {
  snapshotQueryStrategy: "mysql_row_number_latest_per_paid_campaign_id";
  paidCampaignCount: number;
  snapshotRowsReturned: number;
  cooldownDistinctAccountKeys: number;
  durationMs: number;
};

function listProjectionLogEnabled(): boolean {
  const v = process.env.PAID_SOCIAL_LIST_PROJECTION_LOG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function logPaidListProjection(payload: PaidListProjectionLogPayload): void {
  if (!listProjectionLogEnabled()) return;
  console.log("[paid-social-list-projection]", JSON.stringify(payload));
}
