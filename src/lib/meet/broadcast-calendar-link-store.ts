import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastCalendarLinks } from "@/lib/db/schema";
import type { BroadcastCalendarLink, BroadcastCalendarProvider, BroadcastCalendarSyncMode } from "./broadcast-calendar-sync";

function rowToLink(row: typeof meetBroadcastCalendarLinks.$inferSelect): BroadcastCalendarLink {
  return {
    id: row.id,
    userId: row.userId,
    broadcastEventId: row.broadcastEventId,
    provider: row.provider as BroadcastCalendarProvider,
    externalCalendarId: row.externalCalendarId ?? null,
    externalEventId: row.externalEventId ?? null,
    externalEventUrl: row.externalEventUrl ?? null,
    syncMode: row.syncMode as BroadcastCalendarSyncMode,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateBroadcastCalendarLinkInput = {
  userId: number;
  broadcastEventId: number;
  provider: BroadcastCalendarProvider;
  externalCalendarId?: string | null;
  externalEventId?: string | null;
  externalEventUrl?: string | null;
  syncMode: BroadcastCalendarSyncMode;
};

export async function createBroadcastCalendarLink(
  input: CreateBroadcastCalendarLinkInput
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const db = await getDb();
  try {
    const [ins] = await db
      .insert(meetBroadcastCalendarLinks)
      .values({
        userId: input.userId,
        broadcastEventId: input.broadcastEventId,
        provider: input.provider,
        externalCalendarId: input.externalCalendarId ?? null,
        externalEventId: input.externalEventId ?? null,
        externalEventUrl: input.externalEventUrl ?? null,
        syncMode: input.syncMode,
      })
      .$returningId();
    const id = ins?.id != null ? Number(ins.id) : NaN;
    if (!Number.isFinite(id)) return { ok: false, error: "insert_failed" };
    return { ok: true, id };
  } catch {
    return { ok: false, error: "duplicate_or_constraint" };
  }
}

export async function getBroadcastCalendarLinkByBroadcastEventId(
  broadcastEventId: number,
  userId: number
): Promise<BroadcastCalendarLink | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastCalendarLinks)
    .where(
      and(eq(meetBroadcastCalendarLinks.broadcastEventId, broadcastEventId), eq(meetBroadcastCalendarLinks.userId, userId))
    )
    .limit(1);
  return rows[0] ? rowToLink(rows[0]) : null;
}

export async function getBroadcastCalendarLinksByBroadcastEventIds(
  userId: number,
  eventIds: number[]
): Promise<Map<number, BroadcastCalendarLink>> {
  const out = new Map<number, BroadcastCalendarLink>();
  if (eventIds.length === 0) return out;
  const db = await getDb();
  const unique = [...new Set(eventIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const rows = await db
    .select()
    .from(meetBroadcastCalendarLinks)
    .where(
      and(eq(meetBroadcastCalendarLinks.userId, userId), inArray(meetBroadcastCalendarLinks.broadcastEventId, unique))
    );
  for (const r of rows) {
    out.set(r.broadcastEventId, rowToLink(r));
  }
  return out;
}

/** Admin / cross-user dashboard: one link row per broadcast event when present. */
export async function getBroadcastCalendarLinksByBroadcastEventIdsUnscoped(
  eventIds: number[]
): Promise<Map<number, BroadcastCalendarLink>> {
  const out = new Map<number, BroadcastCalendarLink>();
  const unique = [...new Set(eventIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastCalendarLinks)
    .where(inArray(meetBroadcastCalendarLinks.broadcastEventId, unique));
  for (const r of rows) {
    out.set(r.broadcastEventId, rowToLink(r));
  }
  return out;
}

export async function listBroadcastCalendarLinksForUser(userId: number, limit = 50): Promise<BroadcastCalendarLink[]> {
  const db = await getDb();
  const cap = Math.min(100, Math.max(1, limit));
  const rows = await db
    .select()
    .from(meetBroadcastCalendarLinks)
    .where(eq(meetBroadcastCalendarLinks.userId, userId))
    .orderBy(desc(meetBroadcastCalendarLinks.updatedAt))
    .limit(cap);
  return rows.map(rowToLink);
}

export async function updateBroadcastCalendarLink(
  broadcastEventId: number,
  userId: number,
  patch: {
    externalCalendarId?: string | null;
    externalEventId?: string | null;
    externalEventUrl?: string | null;
    syncMode?: BroadcastCalendarSyncMode;
    lastSyncedAt?: Date | null;
  }
): Promise<boolean> {
  const existing = await getBroadcastCalendarLinkByBroadcastEventId(broadcastEventId, userId);
  if (!existing) return false;
  const db = await getDb();
  const setObj: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.externalCalendarId !== undefined) setObj.externalCalendarId = patch.externalCalendarId;
  if (patch.externalEventId !== undefined) setObj.externalEventId = patch.externalEventId;
  if (patch.externalEventUrl !== undefined) setObj.externalEventUrl = patch.externalEventUrl;
  if (patch.syncMode !== undefined) setObj.syncMode = patch.syncMode;
  if (patch.lastSyncedAt !== undefined) setObj.lastSyncedAt = patch.lastSyncedAt;

  await db
    .update(meetBroadcastCalendarLinks)
    .set(setObj as typeof meetBroadcastCalendarLinks.$inferInsert)
    .where(
      and(eq(meetBroadcastCalendarLinks.broadcastEventId, broadcastEventId), eq(meetBroadcastCalendarLinks.userId, userId))
    );
  return true;
}

export async function touchBroadcastCalendarLinkSynced(broadcastEventId: number, userId: number): Promise<void> {
  await updateBroadcastCalendarLink(broadcastEventId, userId, { lastSyncedAt: new Date() });
}

export async function deleteBroadcastCalendarLink(broadcastEventId: number, userId: number): Promise<boolean> {
  const existing = await getBroadcastCalendarLinkByBroadcastEventId(broadcastEventId, userId);
  if (!existing) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastCalendarLinks)
    .where(
      and(eq(meetBroadcastCalendarLinks.broadcastEventId, broadcastEventId), eq(meetBroadcastCalendarLinks.userId, userId))
    );
  return true;
}
