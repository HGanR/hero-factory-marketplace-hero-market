import { desc, eq, sql } from "drizzle-orm";
import { rowsFromMysqlExecute } from "@/lib/db/mysql-execute-select-rows";
import { campaignPostAnalyticsSnapshots } from "@/lib/db/schema";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import type { SocialPostAnalyticsSnapshotPayload } from "@/lib/social/governed-post-analytics-types";
import { logOrganicLatestSnapshotsBatch } from "@/lib/social/governed-post-analytics-latest-batch-log";

export type AnalyticsSnapshotRow = typeof campaignPostAnalyticsSnapshots.$inferSelect;

function coerceSnapshotDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v == null) return new Date(NaN);
  return new Date(String(v));
}

/**
 * Map a raw mysql2 row (snake_case columns) into the Drizzle organic snapshot row shape.
 * Exported for unit tests (Part 56).
 */
export function mapMysqlRowToOrganicAnalyticsSnapshotRow(raw: Record<string, unknown>): AnalyticsSnapshotRow {
  const pid = raw.campaign_post_id ?? raw.campaignPostId;
  const ppid = raw.provider_post_id ?? raw.providerPostId;
  return {
    id: String(raw.id),
    campaignPostId: String(pid),
    provider: String(raw.provider),
    providerPostId: ppid == null || ppid === "" ? null : String(ppid),
    snapshotType: String(raw.snapshot_type ?? raw.snapshotType ?? "platform_lifetime"),
    metricsJson: raw.metrics_json ?? raw.metricsJson,
    fetchedAt: coerceSnapshotDate(raw.fetched_at ?? raw.fetchedAt),
    createdAt: coerceSnapshotDate(raw.created_at ?? raw.createdAt),
  } as AnalyticsSnapshotRow;
}

/**
 * Build latest-per-post map from window-query rows (one row per post id). Exported for tests (Part 56).
 */
export function mergeLatestOrganicSnapshotRowsIntoMap(
  rows: Record<string, unknown>[]
): Map<string, AnalyticsSnapshotRow> {
  const out = new Map<string, AnalyticsSnapshotRow>();
  for (const raw of rows) {
    const mapped = mapMysqlRowToOrganicAnalyticsSnapshotRow(raw);
    out.set(mapped.campaignPostId, mapped);
  }
  return out;
}

export async function insertCampaignPostAnalyticsSnapshot(
  db: SocialPostTimelineDb,
  args: {
    id: string;
    campaignPostId: string;
    provider: string;
    providerPostId: string | null;
    snapshotType?: string;
    payload: SocialPostAnalyticsSnapshotPayload;
    fetchedAt?: Date;
  }
): Promise<void> {
  await db.insert(campaignPostAnalyticsSnapshots).values({
    id: args.id,
    campaignPostId: args.campaignPostId,
    provider: args.provider,
    providerPostId: args.providerPostId,
    snapshotType: args.snapshotType ?? "platform_lifetime",
    metricsJson: args.payload as unknown as Record<string, unknown>,
    fetchedAt: args.fetchedAt ?? new Date(),
    createdAt: new Date(),
  });
}

export async function listRecentSnapshotsForPost(
  db: SocialPostTimelineDb,
  args: { campaignPostId: string; limit?: number }
): Promise<AnalyticsSnapshotRow[]> {
  const lim = Math.min(Math.max(args.limit ?? 8, 1), 50);
  return db
    .select()
    .from(campaignPostAnalyticsSnapshots)
    .where(eq(campaignPostAnalyticsSnapshots.campaignPostId, args.campaignPostId))
    .orderBy(desc(campaignPostAnalyticsSnapshots.fetchedAt), desc(campaignPostAnalyticsSnapshots.id))
    .limit(lim);
}

/**
 * Latest row per post id (true max `fetched_at`, tie-break `id DESC`) in **one** query (Part 56).
 * Parity with paid `getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds` (ROW_NUMBER window).
 *
 * Part 57: requires **MySQL 8+** / **TiDB** (or any engine with `ROW_NUMBER`). Supporting index:
 * **`cp_analytics_latest_per_post_read_idx`** (`drizzle/0090_analytics_snapshots_latest_read_indexes.sql`).
 */
export async function getLatestAnalyticsSnapshotRowsForPostIds(
  db: SocialPostTimelineDb,
  postIds: string[]
): Promise<Map<string, AnalyticsSnapshotRow>> {
  const uniq = Array.from(new Set(postIds.filter(Boolean)));
  if (uniq.length === 0) {
    return new Map();
  }

  const inList = sql.join(
    uniq.map((id) => sql`${id}`),
    sql`, `
  );

  const query = sql`
    SELECT id, campaign_post_id, provider, provider_post_id, snapshot_type, metrics_json, fetched_at, created_at
    FROM (
      SELECT
        id,
        campaign_post_id,
        provider,
        provider_post_id,
        snapshot_type,
        metrics_json,
        fetched_at,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY campaign_post_id
          ORDER BY fetched_at DESC, id DESC
        ) AS rn
      FROM campaign_post_analytics_snapshots
      WHERE campaign_post_id IN (${inList})
    ) ranked
    WHERE rn = 1
  `;

  const executed = await db.execute(query);
  const rawRows = rowsFromMysqlExecute(executed);
  const out = mergeLatestOrganicSnapshotRowsIntoMap(rawRows);

  logOrganicLatestSnapshotsBatch({
    snapshotQueryStrategy: "mysql_row_number_latest_per_post_id",
    distinctPostIds: uniq.length,
    snapshotRowsReturned: rawRows.length,
  });

  return out;
}
