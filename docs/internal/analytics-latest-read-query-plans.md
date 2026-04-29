# Analytics latest-read query plans (Revenue OS)

**Audience:** developers / DB operators. **Part 58** — diagnostic support for **Parts 55–57** latest-per-id snapshot queries.

## Non-prod diagnostic script

From `hero-market/` with **`DATABASE_URL`** set:

```bash
node scripts/explain-analytics-latest-snapshot-queries.mjs
```

Optional JSON (for piping / dashboards):

```bash
node scripts/explain-analytics-latest-snapshot-queries.mjs --json
```

The script runs **`EXPLAIN`** only (no data changes). It uses **placeholder UUIDs** in the `IN (...)` list; rows need not exist — the optimizer still reports **key** / **possible_keys** / **rows** estimates.

**npm alias:** `npm run db:explain-analytics-latest` (see root `package.json`).

## Manual SQL (copy-paste)

Align these with:

- `getLatestAnalyticsSnapshotRowsForPostIds` — `governed-post-analytics-store.ts`
- `getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds` — `paid-social-analytics-store.ts`

Replace sample ids with real ids from your environment if you want row estimates closer to production.

### Organic

```sql
EXPLAIN
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
  WHERE campaign_post_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
) ranked
WHERE rn = 1;
```

### Paid

```sql
EXPLAIN
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
  WHERE campaign_paid_social_campaign_id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')
) ranked
WHERE rn = 1;
```

## Post-deploy checklist (indexes + window functions)

1. Apply migrations through **`0090_analytics_snapshots_latest_read_indexes.sql`** (`npm run db:migrate:all` or your standard pipeline).
2. Confirm server version: **MySQL 8.0+** or **TiDB** with **`ROW_NUMBER`** and (for physical index match) **descending indexes** — see [`social-performance-analytics.md`](./social-performance-analytics.md) Part 57.
3. Run **`npm run db:explain-analytics-latest`** (or manual **`EXPLAIN`** above). Prefer **`key`** / **`possible_keys`** referencing:
   - **`cp_analytics_latest_per_post_read_idx`**
   - **`camp_paid_soc_analytics_latest_per_paid_read_idx`**
4. Smoke UI: **Publishing planner** (posted rows), **campaign analytics** rollup, **paid campaigns list** — should load without timeouts after warm caches.
5. Optional logs (non-prod unless investigating): **`ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG`**, **`PAID_SOCIAL_LIST_PROJECTION_LOG`**.

## Overlapping indexes (evaluation only — Part 58)

| Table | Older index | Columns | New Part 57 index | Overlap |
|-------|-------------|---------|-------------------|---------|
| `campaign_post_analytics_snapshots` | **`cp_analytics_post_fetched_idx`** | `(campaign_post_id, fetched_at)` | **`cp_analytics_latest_per_post_read_idx`** `(campaign_post_id, fetched_at DESC, id DESC)` | Left-prefix overlap on `(campaign_post_id, fetched_at)`; new index strictly better for **ORDER BY fetched_at DESC, id DESC** per post. |
| `campaign_paid_social_analytics_snapshots` | **`camp_paid_soc_analytics_paid_fetched_idx`** | `(campaign_paid_social_campaign_id, fetched_at)` | **`camp_paid_soc_analytics_latest_per_paid_read_idx`** | Same pattern. |

**Do not drop** the older indexes without evidence:

- **`EXPLAIN`** on the two window queries should show stable use of the **triple-column** indexes after **`0090`**.
- Confirm no other queries rely on the **shorter** index alone in a way the optimizer prefers (e.g. very selective `fetched_at` range scans without `id`).
- Monitor **write** load: removing a redundant index reduces insert cost; keep **slow query log** / metrics flat after any future drop.

**Default (Part 58):** keep both index families; re-evaluate in a later part after production **`EXPLAIN`** and load evidence.

## Related docs

- [`social-performance-analytics.md`](./social-performance-analytics.md) — Parts 56–58
- [`paid-social-campaigns.md`](./paid-social-campaigns.md) — paid list batch + indexes
- [`campaign-governance-launch-checklist.md`](./campaign-governance-launch-checklist.md) — deploy + validation

## Analytics test slice

```bash
npm run test:analytics
```

Runs Jest **in-band** over governed + paid snapshot analytics modules and related API specs (see `package.json` for the exact pattern).
