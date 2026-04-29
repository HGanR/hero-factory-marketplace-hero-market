import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastOverlayStates } from "@/lib/db/schema";
import type { BroadcastOverlayState } from "./broadcast-overlays";
import { getDefaultOverlayState, validateBroadcastOverlayState } from "./broadcast-overlays";

export type MeetBroadcastOverlaySessionSource = { id: number; userId: number };

function rowToState(
  broadcastSessionId: number,
  editorUserId: number,
  json: Record<string, unknown>,
  updatedAt: Date
): BroadcastOverlayState | null {
  const merged = {
    ...json,
    broadcastSessionId,
    updatedByUserId: typeof json.updatedByUserId === "number" ? json.updatedByUserId : editorUserId,
    updatedAt: updatedAt.toISOString(),
  };
  const v = validateBroadcastOverlayState(merged);
  return v.ok ? v.state : null;
}

export async function getBroadcastOverlayState(broadcastSessionId: number): Promise<BroadcastOverlayState | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastOverlayStates)
    .where(eq(meetBroadcastOverlayStates.broadcastSessionId, broadcastSessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToState(row.broadcastSessionId, row.userId, row.overlayStateJson as Record<string, unknown>, row.updatedAt);
}

export async function getBroadcastOverlayStateMapForSessions(
  broadcastSessionIds: number[]
): Promise<Map<number, BroadcastOverlayState>> {
  const out = new Map<number, BroadcastOverlayState>();
  const ids = [...new Set(broadcastSessionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastOverlayStates)
    .where(inArray(meetBroadcastOverlayStates.broadcastSessionId, ids));
  for (const row of rows) {
    const st = rowToState(
      row.broadcastSessionId,
      row.userId,
      row.overlayStateJson as Record<string, unknown>,
      row.updatedAt
    );
    if (st) out.set(row.broadcastSessionId, st);
  }
  return out;
}

export async function upsertBroadcastOverlayState(state: BroadcastOverlayState): Promise<void> {
  const v = validateBroadcastOverlayState(state);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const db = await getDb();
  const payload = { ...v.state } as unknown as Record<string, unknown>;
  await db
    .insert(meetBroadcastOverlayStates)
    .values({
      broadcastSessionId: v.state.broadcastSessionId,
      userId: v.state.updatedByUserId,
      overlayStateJson: payload,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: v.state.updatedByUserId,
        overlayStateJson: payload,
        updatedAt: new Date(),
      },
    });
}

export async function resetBroadcastOverlayState(broadcastSessionId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(meetBroadcastOverlayStates)
    .where(eq(meetBroadcastOverlayStates.broadcastSessionId, broadcastSessionId));
}

export async function ensureBroadcastOverlayStateForSession(session: MeetBroadcastOverlaySessionSource): Promise<BroadcastOverlayState> {
  const row = await getBroadcastOverlayState(session.id);
  if (row) return row;
  return getDefaultOverlayState(session.id, session.userId);
}
