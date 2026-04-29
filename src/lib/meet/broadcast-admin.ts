import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessionDestinations, meetBroadcastSessions } from "@/lib/db/schema";

export type MeetBroadcastSessionAdminRow = typeof meetBroadcastSessions.$inferSelect;
export type MeetBroadcastSessionDestinationAdminRow = typeof meetBroadcastSessionDestinations.$inferSelect;

export type MeetBroadcastSessionWithDestinations = {
  session: MeetBroadcastSessionAdminRow;
  destinations: MeetBroadcastSessionDestinationAdminRow[];
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * Operator view: recent sessions with child destination rows, newest first.
 * No stream keys or raw RTMP URLs.
 */
export async function fetchMeetBroadcastSessionsForAdmin(filters: {
  limit?: number;
  status?: string;
  roomId?: string;
  userId?: number;
}): Promise<MeetBroadcastSessionWithDestinations[]> {
  const db = await getDb();
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conds: SQL[] = [];
  if (filters.status?.trim()) {
    conds.push(eq(meetBroadcastSessions.status, filters.status.trim()));
  }
  if (filters.roomId?.trim()) {
    conds.push(eq(meetBroadcastSessions.roomId, filters.roomId.trim()));
  }
  if (filters.userId != null && Number.isFinite(filters.userId)) {
    conds.push(eq(meetBroadcastSessions.userId, filters.userId));
  }

  const sessions = await db
    .select()
    .from(meetBroadcastSessions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(meetBroadcastSessions.createdAt))
    .limit(limit);

  const out: MeetBroadcastSessionWithDestinations[] = [];
  for (const session of sessions) {
    const destinations = await db
      .select()
      .from(meetBroadcastSessionDestinations)
      .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, session.id));
    out.push({ session, destinations });
  }

  return out;
}
