/**
 * Raw SQL helpers for `client_hub_automation_events` — no `client-hub-queries` import (avoids cycles with rollup).
 * Callers must enforce `client_accounts.ownerUserId = userId` before using these.
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { mysqlRows } from "@/lib/site-builder/db";

export type ClientHubAutomationRollupCounts = {
  leadQualifiedCount: number;
  followUpCount: number;
  taskCreatedCount: number;
  bookingScheduledCount: number;
};

function rowKey(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim()) return String(v).trim().toLowerCase();
  }
  return "";
}

export async function countAutomationEventsForClient(
  userId: number,
  clientId: string,
): Promise<ClientHubAutomationRollupCounts> {
  await ensureClientHubTables();
  try {
    const db = await getDb();
    const raw = await db.execute(
      sql`SELECT eventType, COUNT(*) AS cnt
          FROM client_hub_automation_events
          WHERE userId = ${userId} AND clientId = ${clientId}
          GROUP BY eventType`,
    );
    const rows = mysqlRows(raw);
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = rowKey(r as Record<string, unknown>, "eventType", "eventtype");
      const c = Number((r as Record<string, unknown>)["cnt"] ?? (r as Record<string, unknown>)["CNT"] ?? 0);
      m.set(k, Number.isFinite(c) ? c : 0);
    }
    return {
      leadQualifiedCount: m.get("lead_qualified") ?? 0,
      followUpCount: m.get("followup_created") ?? 0,
      taskCreatedCount: m.get("task_created") ?? 0,
      bookingScheduledCount: m.get("booking_scheduled") ?? 0,
    };
  } catch {
    return {
      leadQualifiedCount: 0,
      followUpCount: 0,
      taskCreatedCount: 0,
      bookingScheduledCount: 0,
    };
  }
}

export async function maxAutomationEventCreatedAt(
  userId: number,
  clientId: string,
): Promise<Date | null> {
  try {
    await ensureClientHubTables();
    const db = await getDb();
    const raw = await db.execute(
      sql`SELECT MAX(createdAt) AS m
          FROM client_hub_automation_events
          WHERE userId = ${userId} AND clientId = ${clientId}`,
    );
    const rows = mysqlRows(raw);
    const v = rows[0]?.["m"] ?? rows[0]?.["M"];
    if (v instanceof Date) return v;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

export type AutomationBatchRow = {
  clientId: string;
  counts: ClientHubAutomationRollupCounts;
  eventsLast7Days: number;
};

/**
 * Batch automation metrics for many clients (same owner). `clientIds` must already be owned by `userId`.
 */
export async function loadAutomationBatchForClients(
  userId: number,
  clientIds: string[],
): Promise<Map<string, AutomationBatchRow>> {
  const out = new Map<string, AutomationBatchRow>();
  if (clientIds.length === 0) return out;
  await ensureClientHubTables();
  try {
    const db = await getDb();
    const idList = sql.join(
      clientIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const rawTypes = await db.execute(
      sql`SELECT clientId, eventType, COUNT(*) AS cnt
          FROM client_hub_automation_events
          WHERE userId = ${userId} AND clientId IN (${idList})
          GROUP BY clientId, eventType`,
    );
    const raw7 = await db.execute(
      sql`SELECT clientId, COUNT(*) AS cnt
          FROM client_hub_automation_events
          WHERE userId = ${userId}
            AND clientId IN (${idList})
            AND createdAt >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
          GROUP BY clientId`,
    );

    for (const cid of clientIds) {
      out.set(cid, {
        clientId: cid,
        counts: {
          leadQualifiedCount: 0,
          followUpCount: 0,
          taskCreatedCount: 0,
          bookingScheduledCount: 0,
        },
        eventsLast7Days: 0,
      });
    }

    for (const r of mysqlRows(rawTypes)) {
      const rec = r as Record<string, unknown>;
      const cid = String(rec["clientId"] ?? rec["clientid"] ?? "");
      if (!cid || !out.has(cid)) continue;
      const k = rowKey(rec, "eventType", "eventtype");
      const c = Number(rec["cnt"] ?? rec["CNT"] ?? 0);
      const row = out.get(cid)!;
      if (k === "lead_qualified") row.counts.leadQualifiedCount += c;
      else if (k === "followup_created") row.counts.followUpCount += c;
      else if (k === "task_created") row.counts.taskCreatedCount += c;
      else if (k === "booking_scheduled") row.counts.bookingScheduledCount += c;
    }

    for (const r of mysqlRows(raw7)) {
      const rec = r as Record<string, unknown>;
      const cid = String(rec["clientId"] ?? rec["clientid"] ?? "");
      if (!cid || !out.has(cid)) continue;
      out.get(cid)!.eventsLast7Days = Number(rec["cnt"] ?? rec["CNT"] ?? 0);
    }
  } catch {
    /* */
  }
  return out;
}
