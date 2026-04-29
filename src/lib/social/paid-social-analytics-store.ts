import { desc, eq, sql } from "drizzle-orm";
import { rowsFromMysqlExecute } from "@/lib/db/mysql-execute-select-rows";
import { campaignPaidSocialAnalyticsSnapshots } from "@/lib/db/schema";
import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PaidSocialAnalyticsSnapshotPayload = {
  normalized: PaidSocialNormalizedMetrics;
  /** Optional raw insights row(s) for debugging; may be omitted in production if too large. */
  raw?: unknown;
  /** Part 51: provenance / completeness for operator UI. */
  meta?: {
    insightsSource: "ad" | "adset" | "campaign" | null;
    sourceNotes?: string[];
    metricsCompleteness: string;
    usedFallbackInsights?: boolean;
  };
};

export async function insertPaidSocialAnalyticsSnapshot(
  db: Db,
  args: {
    id: string;
    campaignPaidSocialCampaignId: string;
    provider: string;
    payload: PaidSocialAnalyticsSnapshotPayload;
    fetchedAt?: Date;
  }
): Promise<void> {
  await db.insert(campaignPaidSocialAnalyticsSnapshots).values({
    id: args.id,
    campaignPaidSocialCampaignId: args.campaignPaidSocialCampaignId,
    provider: args.provider,
    metricsJson: args.payload as unknown as Record<string, unknown>,
    fetchedAt: args.fetchedAt ?? new Date(),
    createdAt: new Date(),
  });
}

export async function getLatestPaidSocialAnalyticsSnapshot(
  db: Db,
  campaignPaidSocialCampaignId: string
): Promise<typeof campaignPaidSocialAnalyticsSnapshots.$inferSelect | null> {
  const rows = await db
    .select()
    .from(campaignPaidSocialAnalyticsSnapshots)
    .where(eq(campaignPaidSocialAnalyticsSnapshots.campaignPaidSocialCampaignId, campaignPaidSocialCampaignId))
    .orderBy(desc(campaignPaidSocialAnalyticsSnapshots.fetchedAt), desc(campaignPaidSocialAnalyticsSnapshots.id))
    .limit(1);
  return rows[0] ?? null;
}

export type PaidSocialAnalyticsSnapshotRow = typeof campaignPaidSocialAnalyticsSnapshots.$inferSelect;

/** @deprecated Part 55 — list batch uses ROW_NUMBER latest-per-id; cap removed. Kept for doc/search compatibility. */
export const PAID_SNAPSHOT_LIST_BATCH_ROW_LIMIT = 5000;

export type PaidSnapshotListBatchStrategy = "mysql_row_number_latest_per_paid_campaign_id";

export type LatestPaidSnapshotsForListBatchResult = {
  byPaidCampaignId: Map<string, PaidSocialAnalyticsSnapshotRow | null>;
  snapshotRowsReturned: number;
  snapshotQueryStrategy: PaidSnapshotListBatchStrategy;
};

function coerceSnapshotDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v == null) return new Date(NaN);
  return new Date(String(v));
}

/**
 * Map a raw mysql2 row (snake_case columns) into the Drizzle snapshot row shape.
 * Exported for unit tests (Part 55).
 */
export function mapMysqlRowToPaidSocialAnalyticsSnapshotRow(raw: Record<string, unknown>): PaidSocialAnalyticsSnapshotRow {
  const pid = raw.campaign_paid_social_campaign_id ?? raw.campaignPaidSocialCampaignId;
  return {
    id: String(raw.id),
    campaignPaidSocialCampaignId: String(pid),
    provider: String(raw.provider),
    metricsJson: raw.metrics_json ?? raw.metricsJson,
    fetchedAt: coerceSnapshotDate(raw.fetched_at ?? raw.fetchedAt),
    createdAt: coerceSnapshotDate(raw.created_at ?? raw.createdAt),
  } as PaidSocialAnalyticsSnapshotRow;
}

/**
 * Merge SQL latest-per-id rows into a map with null placeholders for missing ids (Part 55 tests).
 */
export function mergeLatestPaidSnapshotRowsIntoMap(
  uniqPaidCampaignIds: string[],
  rows: Record<string, unknown>[]
): Map<string, PaidSocialAnalyticsSnapshotRow | null> {
  const out = new Map<string, PaidSocialAnalyticsSnapshotRow | null>();
  for (const id of uniqPaidCampaignIds) out.set(id, null);
  for (const raw of rows) {
    const mapped = mapMysqlRowToPaidSocialAnalyticsSnapshotRow(raw);
    out.set(mapped.campaignPaidSocialCampaignId, mapped);
  }
  return out;
}

/**
 * True latest snapshot per paid draft id in **one** query (Parts 54–55).
 * Uses `ROW_NUMBER() OVER (PARTITION BY campaign_paid_social_campaign_id ORDER BY fetched_at DESC, id DESC)` so
 * correctness does not depend on a global row cap (one noisy draft cannot hide another’s latest row).
 *
 * Requires MySQL 8+ / TiDB with window functions.
 *
 * Part 57: supporting index **`camp_paid_soc_analytics_latest_per_paid_read_idx`**
 * (`drizzle/0090_analytics_snapshots_latest_read_indexes.sql`).
 */
export async function getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(
  db: Db,
  campaignPaidSocialCampaignIds: string[]
): Promise<LatestPaidSnapshotsForListBatchResult> {
  const uniq = Array.from(new Set(campaignPaidSocialCampaignIds.filter(Boolean)));
  const emptyMap = new Map<string, PaidSocialAnalyticsSnapshotRow | null>();
  for (const id of uniq) emptyMap.set(id, null);

  if (uniq.length === 0) {
    return {
      byPaidCampaignId: emptyMap,
      snapshotRowsReturned: 0,
      snapshotQueryStrategy: "mysql_row_number_latest_per_paid_campaign_id",
    };
  }

  const inList = sql.join(
    uniq.map((id) => sql`${id}`),
    sql`, `
  );

  const query = sql`
    SELECT id, campaign_paid_social_campaign_id, provider, metrics_json, fetched_at, created_at
    FROM (
      SELECT
        id,
        campaign_paid_social_campaign_id,
        provider,
        metrics_json,
        fetched_at,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY campaign_paid_social_campaign_id
          ORDER BY fetched_at DESC, id DESC
        ) AS rn
      FROM campaign_paid_social_analytics_snapshots
      WHERE campaign_paid_social_campaign_id IN (${inList})
    ) ranked
    WHERE rn = 1
  `;

  const executed = await db.execute(query);
  const rawRows = rowsFromMysqlExecute(executed);

  const byPaidCampaignId = mergeLatestPaidSnapshotRowsIntoMap(uniq, rawRows);

  return {
    byPaidCampaignId,
    snapshotRowsReturned: rawRows.length,
    snapshotQueryStrategy: "mysql_row_number_latest_per_paid_campaign_id",
  };
}
