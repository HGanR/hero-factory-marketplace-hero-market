import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastLiveSceneStates } from "@/lib/db/schema";
import type { BroadcastLiveSceneState, MeetBroadcastSessionSceneSource } from "./broadcast-live-scenes";
import { getDefaultLiveSceneStateFromSession, validateLiveSceneState } from "./broadcast-live-scenes";

function rowToState(
  broadcastSessionId: number,
  editorUserId: number,
  json: Record<string, unknown>,
  updatedAt: Date
): BroadcastLiveSceneState | null {
  const merged = {
    ...json,
    broadcastSessionId,
    updatedByUserId: typeof json.updatedByUserId === "number" ? json.updatedByUserId : editorUserId,
    updatedAt: updatedAt.toISOString(),
  };
  const v = validateLiveSceneState(merged);
  return v.ok ? v.state : null;
}

export async function getBroadcastLiveSceneState(broadcastSessionId: number): Promise<BroadcastLiveSceneState | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastLiveSceneStates)
    .where(eq(meetBroadcastLiveSceneStates.broadcastSessionId, broadcastSessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToState(row.broadcastSessionId, row.userId, row.sceneStateJson as Record<string, unknown>, row.updatedAt);
}

export async function getBroadcastLiveSceneStateMapForSessions(
  broadcastSessionIds: number[]
): Promise<Map<number, BroadcastLiveSceneState>> {
  const out = new Map<number, BroadcastLiveSceneState>();
  const ids = [...new Set(broadcastSessionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastLiveSceneStates)
    .where(inArray(meetBroadcastLiveSceneStates.broadcastSessionId, ids));
  for (const row of rows) {
    const st = rowToState(row.broadcastSessionId, row.userId, row.sceneStateJson as Record<string, unknown>, row.updatedAt);
    if (st) out.set(row.broadcastSessionId, st);
  }
  return out;
}

export async function upsertBroadcastLiveSceneState(state: BroadcastLiveSceneState): Promise<void> {
  const v = validateLiveSceneState(state);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const db = await getDb();
  const payload = { ...v.state } as unknown as Record<string, unknown>;
  await db
    .insert(meetBroadcastLiveSceneStates)
    .values({
      broadcastSessionId: v.state.broadcastSessionId,
      userId: v.state.updatedByUserId,
      sceneStateJson: payload,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: v.state.updatedByUserId,
        sceneStateJson: payload,
        updatedAt: new Date(),
      },
    });
}

export async function resetBroadcastLiveSceneStateToProgram(broadcastSessionId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(meetBroadcastLiveSceneStates)
    .where(eq(meetBroadcastLiveSceneStates.broadcastSessionId, broadcastSessionId));
}

/**
 * Returns persisted live scene or an in-memory default derived from the broadcast session row (no insert).
 */
export async function ensureBroadcastLiveSceneStateForSession(
  session: MeetBroadcastSessionSceneSource
): Promise<BroadcastLiveSceneState> {
  const row = await getBroadcastLiveSceneState(session.id);
  if (row) return row;
  return getDefaultLiveSceneStateFromSession(session, session.userId);
}
