import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastOverlayPacks } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import { incrementBroadcastOverlayPackApply, incrementBroadcastOverlayPackCreate } from "./broadcast-metrics";
import type { BroadcastOverlayPack } from "./broadcast-overlay-packs";
import { validateBroadcastOverlayPack } from "./broadcast-overlay-packs";

function rowToPack(row: typeof meetBroadcastOverlayPacks.$inferSelect): BroadcastOverlayPack {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? null,
    lowerThirdPresetJson: (row.lowerThirdPresetJson as Record<string, unknown> | null) ?? null,
    tickerPresetJson: (row.tickerPresetJson as Record<string, unknown> | null) ?? null,
    ctaPresetJson: (row.ctaPresetJson as Record<string, unknown> | null) ?? null,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

export async function getBroadcastOverlayPackById(id: number, userId: number): Promise<BroadcastOverlayPack | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastOverlayPacks)
    .where(and(eq(meetBroadcastOverlayPacks.id, id), eq(meetBroadcastOverlayPacks.userId, userId)))
    .limit(1);
  return rows[0] ? rowToPack(rows[0]) : null;
}

export async function listBroadcastOverlayPacksForUser(userId: number, limit = 50): Promise<BroadcastOverlayPack[]> {
  const db = await getDb();
  const cap = Math.min(100, Math.max(1, limit));
  const rows = await db
    .select()
    .from(meetBroadcastOverlayPacks)
    .where(eq(meetBroadcastOverlayPacks.userId, userId))
    .orderBy(desc(meetBroadcastOverlayPacks.updatedAt))
    .limit(cap);
  return rows.map(rowToPack);
}

export async function createBroadcastOverlayPack(
  userId: number,
  body: Record<string, unknown>
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const v = validateBroadcastOverlayPack(body, "create");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;
  if (!d.name) return { ok: false, errors: ["name required"] };
  const db = await getDb();
  const [ins] = await db
    .insert(meetBroadcastOverlayPacks)
    .values({
      userId,
      name: d.name,
      description: d.description ?? null,
      lowerThirdPresetJson: d.lowerThirdPresetJson ?? null,
      tickerPresetJson: d.tickerPresetJson ?? null,
      ctaPresetJson: d.ctaPresetJson ?? null,
    })
    .$returningId();
  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) return { ok: false, errors: ["insert_failed"] };
  incrementBroadcastOverlayPackCreate({ userId, sessionId: null, roomId: null });
  return { ok: true, id };
}

export async function updateBroadcastOverlayPack(
  id: number,
  userId: number,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (!(await getBroadcastOverlayPackById(id, userId))) return { ok: false, errors: ["not_found"] };
  const v = validateBroadcastOverlayPack(body, "patch");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;
  const db = await getDb();
  const setObj: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) setObj.name = d.name;
  if (d.description !== undefined) setObj.description = d.description;
  if (d.lowerThirdPresetJson !== undefined) setObj.lowerThirdPresetJson = d.lowerThirdPresetJson;
  if (d.tickerPresetJson !== undefined) setObj.tickerPresetJson = d.tickerPresetJson;
  if (d.ctaPresetJson !== undefined) setObj.ctaPresetJson = d.ctaPresetJson;
  await db
    .update(meetBroadcastOverlayPacks)
    .set(setObj as typeof meetBroadcastOverlayPacks.$inferInsert)
    .where(and(eq(meetBroadcastOverlayPacks.id, id), eq(meetBroadcastOverlayPacks.userId, userId)));
  return { ok: true };
}

export async function deleteBroadcastOverlayPack(id: number, userId: number): Promise<boolean> {
  if (!(await getBroadcastOverlayPackById(id, userId))) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastOverlayPacks)
    .where(and(eq(meetBroadcastOverlayPacks.id, id), eq(meetBroadcastOverlayPacks.userId, userId)));
  return true;
}

/** Metrics hook when operator applies pack to live overlay state (call from API or client-triggered path). */
export function recordBroadcastOverlayPackApplied(userId: number, overlayPackId: number): void {
  incrementBroadcastOverlayPackApply({ userId, sessionId: null, roomId: null, reason: String(overlayPackId) });
  broadcastAudit("broadcast_overlay_pack_applied", { userId, overlayPackId });
}
