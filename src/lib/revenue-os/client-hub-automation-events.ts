import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import type { ClientActivityItem } from "@/lib/revenue-os/client-hub-types";
import { mysqlRows } from "@/lib/site-builder/db";

export type { ClientHubAutomationRollupCounts } from "@/lib/revenue-os/client-hub-automation-sql";

export const CLIENT_HUB_EVENT_TYPES = [
  "campaign_created",
  "campaign_launched",
  "post_published",
  "lead_qualified",
  "followup_created",
  "booking_scheduled",
  "task_created",
] as const;

export type ClientHubEventType = (typeof CLIENT_HUB_EVENT_TYPES)[number];

/**
 * Safe insert — best-effort; does not throw to callers in hot paths.
 */
export async function recordClientHubAutomationEvent(
  userId: number,
  clientId: string,
  eventType: string,
  options?: { refId?: string | null; metadata?: Record<string, unknown> | null },
): Promise<void> {
  if (!clientId) return;
  try {
    await ensureClientHubTables();
    const owned = await getOwnedClientRow(userId, clientId);
    if (!owned) return;
    const db = await getDb();
    const id = crypto.randomUUID();
    const meta = options?.metadata != null ? JSON.stringify(options.metadata) : null;
    const ref = options?.refId ?? null;
    await db.execute(
      sql`INSERT INTO client_hub_automation_events (id, userId, clientId, eventType, refId, metadata, createdAt)
          VALUES (
            ${id},
            ${userId},
            ${clientId},
            ${eventType},
            ${ref},
            ${meta},
            NOW(3)
          )`,
    );
  } catch (e) {
    console.warn("[client_hub_automation_events]", e);
  }
}

export async function listAutomationEventsForClientTimeline(
  userId: number,
  clientId: string,
  limit: number,
): Promise<ClientActivityItem[]> {
  const owned = await getOwnedClientRow(userId, clientId);
  if (!owned) return [];
  try {
    await ensureClientHubTables();
    const db = await getDb();
    const raw = await db.execute(
      sql`SELECT id, eventType, refId, metadata, createdAt
          FROM client_hub_automation_events
          WHERE userId = ${userId} AND clientId = ${clientId}
          ORDER BY createdAt DESC
          LIMIT ${Math.min(40, limit)}`,
    );
    const data = mysqlRows(raw);
    return data.map((r) => {
      const type = String(r["eventType"] ?? r["eventtype"] ?? "event");
      const when = r["createdAt"] ?? r["created_at"];
      const d =
        when instanceof Date
          ? when
          : typeof when === "string" || typeof when === "number"
            ? new Date(when)
            : new Date();
      const title = `Automation · ${type.replace(/_/g, " ")}`;
      let detail: string | null = r["refId"] != null ? `Ref: ${String(r["refId"])}` : null;
      try {
        if (r["metadata"] && typeof r["metadata"] === "string") {
          const j = JSON.parse(r["metadata"]) as { summary?: string };
          if (j?.summary) detail = j.summary;
        }
      } catch {
        /* */
      }
      return {
        id: `chae-${String(r["id"])}`,
        kind: "automation" as const,
        title,
        detail,
        occurredAt: d.toISOString(),
      } satisfies ClientActivityItem;
    });
  } catch {
    return [];
  }
}
