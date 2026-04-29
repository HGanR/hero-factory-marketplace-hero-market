import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { ClientActivityItem } from "@/lib/revenue-os/client-hub-types";
import { mysqlRows } from "@/lib/site-builder/db";

/**
 * Optional `platform_events` table (if present, columns may vary by migration).
 * Returns [] when the table is missing or the query is incompatible.
 */
export async function fetchPlatformEventsForClientTimeline(
  userId: number,
  clientId: string,
  limit: number,
): Promise<ClientActivityItem[]> {
  const db = await getDb();
  const cap = Math.min(24, limit);
  try {
    const raw = await db.execute(
      sql`SELECT id, created_at, title, event_type, body, message, name, user_id, owner_user_id
          FROM platform_events
          WHERE client_id = ${clientId}
            AND (user_id = ${String(userId)} OR owner_user_id = ${userId})
          ORDER BY created_at DESC
          LIMIT ${cap}`,
    );
    const rows = mysqlRows(raw);
    return mapRowsToActivity(rows);
  } catch {
    try {
      const raw2 = await db.execute(
        sql`SELECT * FROM platform_events
            WHERE client_id = ${clientId} AND user_id = ${String(userId)}
            ORDER BY created_at DESC
            LIMIT ${cap}`,
      );
      return mapRowsToActivity(mysqlRows(raw2));
    } catch {
      return [];
    }
  }
}

function mapRowsToActivity(rows: Record<string, unknown>[]): ClientActivityItem[] {
  const out: ClientActivityItem[] = [];
  for (const r of rows) {
    const id = r.id != null ? String(r.id) : null;
    if (!id) continue;
    const created = r["created_at"] ?? r["createdAt"];
    const t =
      created instanceof Date
        ? created
        : typeof created === "string" || typeof created === "number"
          ? new Date(created)
          : new Date();
    const titleBase =
      String(
        (r["title"] ?? r["name"] ?? r["event_type"] ?? r["type"] ?? "Platform event") as string,
      ).trim() || "Platform event";
    const d =
      r["body"] ?? r["message"] ?? r["detail"] ?? (typeof r["payload"] === "string" ? r["payload"] : null);
    const detail = d != null ? String(d).slice(0, 200) : null;
    out.push({
      id: `pe-${id}`,
      kind: "platform_event",
      title: `Platform · ${titleBase}`,
      detail,
      occurredAt: Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString(),
    });
  }
  return out;
}
