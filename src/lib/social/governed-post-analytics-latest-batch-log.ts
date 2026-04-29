/**
 * Optional structured logging for organic latest-snapshot batch reads (Part 56).
 * Enable with ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG=1 or true (case-insensitive).
 */

export type OrganicLatestSnapshotsBatchLogPayload = {
  snapshotQueryStrategy: "mysql_row_number_latest_per_post_id";
  distinctPostIds: number;
  snapshotRowsReturned: number;
};

function enabled(): boolean {
  const v = process.env.ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function logOrganicLatestSnapshotsBatch(payload: OrganicLatestSnapshotsBatchLogPayload): void {
  if (!enabled()) return;
  console.log("[organic-post-analytics-latest-batch]", JSON.stringify(payload));
}
