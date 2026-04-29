import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastGuestCardPacks } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import { incrementBroadcastGuestCardApply, incrementBroadcastGuestCardPackCreate } from "./broadcast-metrics";
import { validateBroadcastGuestCardPackJson, type BroadcastGuestCardPackJson } from "./broadcast-guest-cards";

export type BroadcastGuestCardPackRow = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  guestCardsJson: BroadcastGuestCardPackJson;
  createdAtIso: string;
  updatedAtIso: string;
};

function rowTo(row: typeof meetBroadcastGuestCardPacks.$inferSelect): BroadcastGuestCardPackRow | null {
  const raw = row.guestCardsJson as unknown;
  const v =
    raw != null && typeof raw === "object" && !Array.isArray(raw) && "cards" in (raw as object)
      ? validateBroadcastGuestCardPackJson(raw)
      : validateBroadcastGuestCardPackJson({ cards: Array.isArray(raw) ? raw : [] });
  if (!v.ok) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? null,
    guestCardsJson: v.data,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

export async function getBroadcastGuestCardPackById(id: number, userId: number): Promise<BroadcastGuestCardPackRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastGuestCardPacks)
    .where(and(eq(meetBroadcastGuestCardPacks.id, id), eq(meetBroadcastGuestCardPacks.userId, userId)))
    .limit(1);
  const r = rows[0];
  return r ? rowTo(r) : null;
}

export async function listBroadcastGuestCardPacksForUser(userId: number, limit = 50): Promise<BroadcastGuestCardPackRow[]> {
  const db = await getDb();
  const cap = Math.min(100, Math.max(1, limit));
  const rows = await db
    .select()
    .from(meetBroadcastGuestCardPacks)
    .where(eq(meetBroadcastGuestCardPacks.userId, userId))
    .orderBy(desc(meetBroadcastGuestCardPacks.updatedAt))
    .limit(cap);
  const out: BroadcastGuestCardPackRow[] = [];
  for (const row of rows) {
    const dto = rowTo(row);
    if (dto) out.push(dto);
  }
  return out;
}

export async function createBroadcastGuestCardPack(
  userId: number,
  input: { name: string; description?: string | null; guestCardsJson: unknown }
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, errors: ["name required"] };
  const raw = input.guestCardsJson;
  const v =
    raw != null && typeof raw === "object" && !Array.isArray(raw) && "cards" in (raw as object)
      ? validateBroadcastGuestCardPackJson(raw)
      : validateBroadcastGuestCardPackJson({ cards: Array.isArray(raw) ? raw : [] });
  if (!v.ok) return { ok: false, errors: v.errors };
  const db = await getDb();
  const [ins] = await db
    .insert(meetBroadcastGuestCardPacks)
    .values({
      userId,
      name: name.slice(0, 160),
      description: input.description?.slice(0, 2000) ?? null,
      guestCardsJson: v.data as unknown as Record<string, unknown>,
    })
    .$returningId();
  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) return { ok: false, errors: ["insert_failed"] };
  incrementBroadcastGuestCardPackCreate({ userId, sessionId: null, roomId: null });
  return { ok: true, id };
}

export async function updateBroadcastGuestCardPack(
  id: number,
  userId: number,
  patch: { name?: string; description?: string | null; guestCardsJson?: unknown }
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (!(await getBroadcastGuestCardPackById(id, userId))) return { ok: false, errors: ["not_found"] };
  const db = await getDb();
  const setObj: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) setObj.name = patch.name.trim().slice(0, 160);
  if (patch.description !== undefined) setObj.description = patch.description?.slice(0, 2000) ?? null;
  if (patch.guestCardsJson !== undefined) {
    const raw = patch.guestCardsJson;
    const v =
      raw != null && typeof raw === "object" && !Array.isArray(raw) && "cards" in (raw as object)
        ? validateBroadcastGuestCardPackJson(raw)
        : validateBroadcastGuestCardPackJson({ cards: Array.isArray(raw) ? raw : [] });
    if (!v.ok) return { ok: false, errors: v.errors };
    setObj.guestCardsJson = v.data as unknown as Record<string, unknown>;
  }
  await db
    .update(meetBroadcastGuestCardPacks)
    .set(setObj as typeof meetBroadcastGuestCardPacks.$inferInsert)
    .where(and(eq(meetBroadcastGuestCardPacks.id, id), eq(meetBroadcastGuestCardPacks.userId, userId)));
  return { ok: true };
}

export async function deleteBroadcastGuestCardPack(id: number, userId: number): Promise<boolean> {
  if (!(await getBroadcastGuestCardPackById(id, userId))) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastGuestCardPacks)
    .where(and(eq(meetBroadcastGuestCardPacks.id, id), eq(meetBroadcastGuestCardPacks.userId, userId)));
  return true;
}

export function recordBroadcastGuestCardApplied(userId: number, guestCardId: string): void {
  incrementBroadcastGuestCardApply({ userId, sessionId: null, roomId: null, reason: guestCardId.slice(0, 120) });
  broadcastAudit("broadcast_guest_card_applied", { userId, guestCardId: guestCardId.slice(0, 120) });
}
