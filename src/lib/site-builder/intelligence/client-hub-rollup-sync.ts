import { sql } from "drizzle-orm";
import type { ClientHubRollup } from "@/lib/revenue-os/client-hub-types";
import type { DbClient } from "@/lib/site-builder/intelligence/repository";
import { ensureSiteBuilderIntelligenceTables } from "@/lib/site-builder/db";

/** Maps Client Hub rollup to intelligence columns — counts only, no message bodies or PII. */
export function mapClientHubRollupToIntelligenceMetrics(roll: ClientHubRollup): {
  rollupLeadsCaptured: number;
  rollupConversationsOpened: number;
  rollupWidgetMessages: number;
  rollupBookingsScheduled: number;
} {
  return {
    rollupLeadsCaptured: Math.max(0, Math.floor(roll.leadsCaptured)),
    rollupConversationsOpened: Math.max(0, Math.floor(roll.conversationsOpened)),
    rollupWidgetMessages: Math.max(0, Math.floor(roll.widgetMessagesCount)),
    rollupBookingsScheduled: Math.max(0, Math.floor(roll.bookingScheduledCount)),
  };
}

export type SiteIntelligenceSyncResult = {
  rowsMatched: number;
  rowsChanged: number;
};

function n(x: unknown): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function parseRowsChanged(raw: unknown): number {
  const arr = raw as [unknown, unknown] | undefined;
  const r0 = Array.isArray(arr) ? arr[0] : raw;
  if (r0 && typeof r0 === "object") {
    const obj = r0 as Record<string, unknown>;
    return n(obj.changedRows ?? obj.affectedRows ?? obj.rowCount ?? 0);
  }
  return 0;
}

/**
 * Writes aggregate Client Hub performance into `site_generation_runs` for this client’s sites.
 * Scoped by `userId` + (`clientId` OR `siteId` in list). No CRM text stored.
 */
export async function syncClientHubRollupToSiteIntelligence(
  db: DbClient,
  userId: number,
  clientId: string,
  siteIds: string[],
  roll: ClientHubRollup,
  opts?: { dryRun?: boolean },
): Promise<SiteIntelligenceSyncResult> {
  await ensureSiteBuilderIntelligenceTables(db);
  const m = mapClientHubRollupToIntelligenceMetrics(roll);
  const dryRun = Boolean(opts?.dryRun);
  const hasDiff = sql`
    (
      COALESCE(rollupLeadsCaptured, -1) <> ${m.rollupLeadsCaptured}
      OR COALESCE(rollupConversationsOpened, -1) <> ${m.rollupConversationsOpened}
      OR COALESCE(rollupWidgetMessages, -1) <> ${m.rollupWidgetMessages}
      OR COALESCE(rollupBookingsScheduled, -1) <> ${m.rollupBookingsScheduled}
    )
  `;
  if (siteIds.length === 0) {
    const countRes = await db.execute(sql`
      SELECT COUNT(*) AS n
      FROM site_generation_runs
      WHERE userId = ${userId}
        AND clientId = ${clientId}
    `);
    const rows = ((countRes as [unknown, unknown])?.[0] ?? []) as Array<Record<string, unknown>>;
    const rowsMatched = n(rows[0]?.n);
    if (dryRun) return { rowsMatched, rowsChanged: 0 };
    const updateRes = await db.execute(sql`
      UPDATE site_generation_runs
      SET rollupLeadsCaptured = ${m.rollupLeadsCaptured},
          rollupConversationsOpened = ${m.rollupConversationsOpened},
          rollupWidgetMessages = ${m.rollupWidgetMessages},
          rollupBookingsScheduled = ${m.rollupBookingsScheduled},
          updatedAt = NOW()
      WHERE userId = ${userId} AND clientId = ${clientId}
        AND ${hasDiff}
    `);
    return { rowsMatched, rowsChanged: parseRowsChanged(updateRes) };
  }
  const placeholders = sql.join(siteIds.map((id) => sql`${id}`), sql`, `);
  const countRes = await db.execute(sql`
    SELECT COUNT(*) AS n
    FROM site_generation_runs
    WHERE userId = ${userId}
      AND (clientId = ${clientId} OR siteId IN (${placeholders}))
  `);
  const rows = ((countRes as [unknown, unknown])?.[0] ?? []) as Array<Record<string, unknown>>;
  const rowsMatched = n(rows[0]?.n);
  if (dryRun) return { rowsMatched, rowsChanged: 0 };
  const updateRes = await db.execute(sql`
    UPDATE site_generation_runs
    SET rollupLeadsCaptured = ${m.rollupLeadsCaptured},
        rollupConversationsOpened = ${m.rollupConversationsOpened},
        rollupWidgetMessages = ${m.rollupWidgetMessages},
        rollupBookingsScheduled = ${m.rollupBookingsScheduled},
        updatedAt = NOW()
    WHERE userId = ${userId}
      AND (clientId = ${clientId} OR siteId IN (${placeholders}))
      AND ${hasDiff}
  `);
  return { rowsMatched, rowsChanged: parseRowsChanged(updateRes) };
}
