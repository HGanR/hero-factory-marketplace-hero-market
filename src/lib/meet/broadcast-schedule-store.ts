import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastScheduleStates } from "@/lib/db/schema";
import type { BroadcastScheduleState } from "./broadcast-schedule";
import {
  getDefaultBroadcastScheduleState,
  validateBroadcastScheduleState,
} from "./broadcast-schedule";

export type MeetBroadcastScheduleSessionSource = { id: number; userId: number };

function rowToState(
  broadcastSessionId: number,
  editorUserId: number,
  json: Record<string, unknown>,
  updatedAt: Date
): BroadcastScheduleState | null {
  const merged = {
    ...json,
    broadcastSessionId,
    updatedByUserId: typeof json.updatedByUserId === "number" ? json.updatedByUserId : editorUserId,
    updatedAt: updatedAt.toISOString(),
  };
  const v = validateBroadcastScheduleState(merged);
  return v.ok ? v.state : null;
}

export async function getBroadcastScheduleState(broadcastSessionId: number): Promise<BroadcastScheduleState | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastScheduleStates)
    .where(eq(meetBroadcastScheduleStates.broadcastSessionId, broadcastSessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToState(row.broadcastSessionId, row.userId, row.scheduleStateJson as Record<string, unknown>, row.updatedAt);
}

export async function getBroadcastScheduleStateMapForSessions(
  broadcastSessionIds: number[]
): Promise<Map<number, BroadcastScheduleState>> {
  const out = new Map<number, BroadcastScheduleState>();
  const ids = [...new Set(broadcastSessionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastScheduleStates)
    .where(inArray(meetBroadcastScheduleStates.broadcastSessionId, ids));
  for (const row of rows) {
    const st = rowToState(
      row.broadcastSessionId,
      row.userId,
      row.scheduleStateJson as Record<string, unknown>,
      row.updatedAt
    );
    if (st) out.set(row.broadcastSessionId, st);
  }
  return out;
}

export async function upsertBroadcastScheduleState(state: BroadcastScheduleState): Promise<void> {
  const v = validateBroadcastScheduleState(state);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const db = await getDb();
  const payload = { ...v.state } as unknown as Record<string, unknown>;
  await db
    .insert(meetBroadcastScheduleStates)
    .values({
      broadcastSessionId: v.state.broadcastSessionId,
      userId: v.state.updatedByUserId,
      scheduleStateJson: payload,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: v.state.updatedByUserId,
        scheduleStateJson: payload,
        updatedAt: new Date(),
      },
    });
}

export async function resetBroadcastScheduleState(broadcastSessionId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(meetBroadcastScheduleStates)
    .where(eq(meetBroadcastScheduleStates.broadcastSessionId, broadcastSessionId));
}

export async function ensureBroadcastScheduleStateForSession(
  session: MeetBroadcastScheduleSessionSource
): Promise<BroadcastScheduleState> {
  const row = await getBroadcastScheduleState(session.id);
  if (row) return row;
  return getDefaultBroadcastScheduleState(session.id, session.userId);
}
