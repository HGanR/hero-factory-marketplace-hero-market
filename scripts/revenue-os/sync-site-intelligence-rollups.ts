/**
 * Controlled Site Intelligence rollup sync.
 * Run: npx tsx scripts/revenue-os/sync-site-intelligence-rollups.ts
 */
import { asc, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientAccounts } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import type { ClientAccountRow } from "@/lib/revenue-os/client-hub-types";
import { syncClientHubRollupToSiteIntelligence } from "@/lib/site-builder/intelligence/client-hub-rollup-sync";

function nEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function runSiteIntelligenceRollupSync(opts?: { limit?: number; dryRun?: boolean; batchSize?: number }) {
  const limit = opts?.limit ?? nEnv("SITE_INTELLIGENCE_SYNC_LIMIT", 500);
  const dryRun = opts?.dryRun ?? process.env.SITE_INTELLIGENCE_SYNC_DRY_RUN === "1";
  const batchSize = Math.max(1, Math.min(200, opts?.batchSize ?? 50));
  await ensureClientHubTables();
  const db = await getDb();
  let processed = 0;
  let failed = 0;
  let totalRowsMatched = 0;
  let totalRowsChanged = 0;
  let cursor: string | null = null;

  while (processed < limit) {
    const rows = await db
      .select({
        id: clientAccounts.id,
        ownerUserId: clientAccounts.ownerUserId,
        updatedAt: clientAccounts.updatedAt,
      })
      .from(clientAccounts)
      .where(cursor ? gt(clientAccounts.id, cursor) : undefined)
      .orderBy(asc(clientAccounts.id))
      .limit(Math.min(batchSize, limit - processed));
    if (rows.length === 0) break;
    for (const row of rows) {
      const startedAt = Date.now();
      const userId = Number(row.ownerUserId);
      const clientId = String(row.id);
      cursor = clientId;
      try {
        const roll = await getClientHubRollupForOwnedClient(userId, clientId, row as unknown as ClientAccountRow, {
          skipIntelligenceWriteback: true,
        });
        const stat = await syncClientHubRollupToSiteIntelligence(db, userId, clientId, [], roll, { dryRun });
        totalRowsMatched += stat.rowsMatched;
        totalRowsChanged += stat.rowsChanged;
        console.info("[site-intelligence cron sync]", {
          userId,
          clientId,
          rowsMatched: stat.rowsMatched,
          rowsChanged: stat.rowsChanged,
          durationMs: Date.now() - startedAt,
          dryRun,
        });
      } catch (error) {
        failed += 1;
        console.error("[site-intelligence cron sync failed]", {
          userId,
          clientId,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        processed += 1;
      }
    }
  }

  const summary = {
    processed,
    failed,
    rowsMatched: totalRowsMatched,
    rowsChanged: totalRowsChanged,
    dryRun,
  };
  console.info("[site-intelligence cron summary]", summary);
  return summary;
}

export function resolveSiteIntelligenceSyncRuntimeOpts(): { limit: number; dryRun: boolean } {
  return {
    limit: nEnv("SITE_INTELLIGENCE_SYNC_LIMIT", 500),
    dryRun: process.env.SITE_INTELLIGENCE_SYNC_DRY_RUN === "1",
  };
}

if (require.main === module) {
  const runtime = resolveSiteIntelligenceSyncRuntimeOpts();
  runSiteIntelligenceRollupSync({ limit: runtime.limit, dryRun: runtime.dryRun })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[site-intelligence cron fatal]", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}
