import { randomBytes } from "crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastRenderSessions } from "@/lib/db/schema";
import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export type BroadcastRenderSessionRow = typeof meetBroadcastRenderSessions.$inferSelect;

function newAccessToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createBroadcastRenderSession(params: {
  broadcastSessionId: number;
  userId: number;
  renderModel: BroadcastCompositorRenderModel;
  ttlMs?: number;
}): Promise<BroadcastRenderSessionRow> {
  const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const accessToken = newAccessToken();
  const db = await getDb();
  const [ins] = await db
    .insert(meetBroadcastRenderSessions)
    .values({
      broadcastSessionId: params.broadcastSessionId,
      userId: params.userId,
      accessToken,
      renderModelJson: params.renderModel as unknown as Record<string, unknown>,
      expiresAt,
    })
    .$returningId();

  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) throw new Error("Failed to create render session");

  const rows = await db.select().from(meetBroadcastRenderSessions).where(eq(meetBroadcastRenderSessions.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Render session missing after insert");
  return row;
}

export async function getBroadcastRenderSessionByToken(
  id: number,
  accessToken: string
): Promise<BroadcastRenderSessionRow | null> {
  await deleteExpiredBroadcastRenderSessions();
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastRenderSessions)
    .where(
      and(eq(meetBroadcastRenderSessions.id, id), eq(meetBroadcastRenderSessions.accessToken, accessToken.trim()))
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

export async function deleteExpiredBroadcastRenderSessions(): Promise<void> {
  const db = await getDb();
  await db.delete(meetBroadcastRenderSessions).where(lt(meetBroadcastRenderSessions.expiresAt, new Date()));
}

export const BROADCAST_RENDER_SESSION_TTL_MS = DEFAULT_TTL_MS;

/** Latest render session row for a broadcast (for auto-directing signals); skips expired rows. */
export async function getLatestBroadcastRenderSessionForBroadcast(
  broadcastSessionId: number
): Promise<BroadcastRenderSessionRow | null> {
  await deleteExpiredBroadcastRenderSessions();
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastRenderSessions)
    .where(eq(meetBroadcastRenderSessions.broadcastSessionId, broadcastSessionId))
    .orderBy(desc(meetBroadcastRenderSessions.id))
    .limit(3);
  const now = Date.now();
  for (const row of rows) {
    if (row.expiresAt.getTime() > now) return row;
  }
  return null;
}
