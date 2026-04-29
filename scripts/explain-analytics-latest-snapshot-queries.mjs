#!/usr/bin/env node
/**
 * NON-PRODUCTION DIAGNOSTIC — prints EXPLAIN plans for Revenue OS latest-snapshot batch queries
 * (organic `campaign_post_analytics_snapshots` + paid `campaign_paid_social_analytics_snapshots`).
 *
 * Does not modify data. Requires DATABASE_URL (.env / .env.local). Do not wire into app startup or CI by default.
 *
 * Usage:
 *   node scripts/explain-analytics-latest-snapshot-queries.mjs
 *   node scripts/explain-analytics-latest-snapshot-queries.mjs --json
 *
 * Query shapes must stay aligned with:
 *   - src/lib/social/governed-post-analytics-store.ts → getLatestAnalyticsSnapshotRowsForPostIds
 *   - src/lib/social/paid-social-analytics-store.ts → getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createConnection } from "mysql2/promise";

const SAMPLE_POST_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];
const SAMPLE_PAID_IDS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
];

const ORGANIC_LATEST_SQL = `
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
  WHERE campaign_post_id IN (${SAMPLE_POST_IDS.map(() => "?").join(", ")})
) ranked
WHERE rn = 1
`.trim();

const PAID_LATEST_SQL = `
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
  WHERE campaign_paid_social_campaign_id IN (${SAMPLE_PAID_IDS.map(() => "?").join(", ")})
) ranked
WHERE rn = 1
`.trim();

function getConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env or .env.local");
    process.exit(1);
  }
  const baseUrl = url.trim().replace(/^["']|["']$/g, "").split("?")[0];
  const parsed = new URL(baseUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 4000,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname?.replace(/^\//, "") || "hero-market",
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const asJson = process.argv.includes("--json");
  if (!asJson) {
    console.error(
      "[explain-analytics-latest-snapshot-queries] NON-PROD DIAGNOSTIC — EXPLAIN only, no writes. " +
        "Sample UUIDs may not exist; plans still show index access.\n"
    );
  }

  const config = getConnectionConfig();
  const conn = await createConnection(config);
  const out = { organic: null, paid: null, database: config.database };

  try {
    const [organicRows] = await conn.query(`EXPLAIN ${ORGANIC_LATEST_SQL}`, SAMPLE_POST_IDS);
    const [paidRows] = await conn.query(`EXPLAIN ${PAID_LATEST_SQL}`, SAMPLE_PAID_IDS);
    out.organic = organicRows;
    out.paid = paidRows;
  } finally {
    await conn.end();
  }

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log("=== Organic latest-per-post (campaign_post_analytics_snapshots) ===");
    console.table(out.organic);
    console.log("\n=== Paid latest-per-draft (campaign_paid_social_analytics_snapshots) ===");
    console.table(out.paid);
    console.log(
      "\nLook for key/index usage: cp_analytics_latest_per_post_read_idx, " +
        "camp_paid_soc_analytics_latest_per_paid_read_idx (Part 57). " +
        "See docs/internal/analytics-latest-read-query-plans.md"
    );
  }
}

main().catch((err) => {
  console.error("EXPLAIN failed:", err.message);
  process.exit(1);
});
