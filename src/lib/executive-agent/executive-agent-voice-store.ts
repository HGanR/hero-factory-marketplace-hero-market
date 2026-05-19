import "server-only";

import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentVoiceSessions, executiveAgentVoiceTurns } from "@/lib/db/schema";
import type { ExecutiveVoiceSessionPayload } from "@/lib/executive-agent/executive-voice-provider";

export async function persistExecutiveVoiceSessionStart(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  payload: ExecutiveVoiceSessionPayload
): Promise<void> {
  await db.insert(executiveAgentVoiceSessions).values({
    id: payload.sessionId,
    adminUserId,
    provider: payload.provider,
    status: payload.status,
    inputMode: payload.inputMode,
    outputMode: payload.outputMode,
    expiresAt: new Date(payload.expiresAt),
    clientConfigJson: JSON.stringify(payload.clientConfig ?? {}).slice(0, 50_000),
  });
}

export async function insertExecutiveVoiceTurn(
  db: MySql2Database<typeof schema>,
  input: {
    sessionId: string;
    adminUserId: number;
    transcriptText: string;
    responseText: string;
    plannerMeta: Record<string, unknown> | null;
    proposedApprovalsCount: number;
    orchestratorSource?: string;
  }
): Promise<string> {
  const id = randomUUID();
  await db.insert(executiveAgentVoiceTurns).values({
    id,
    sessionId: input.sessionId,
    adminUserId: input.adminUserId,
    transcriptText: input.transcriptText.slice(0, 100_000),
    responseText: input.responseText.slice(0, 200_000),
    plannerMetaJson: input.plannerMeta ? JSON.stringify(input.plannerMeta).slice(0, 50_000) : null,
    proposedApprovalsCount: input.proposedApprovalsCount,
    orchestratorSource: (input.orchestratorSource ?? "voice").slice(0, 24),
  });
  return id;
}

export async function endExecutiveVoiceSession(
  db: MySql2Database<typeof schema>,
  sessionId: string,
  adminUserId: number
): Promise<boolean> {
  const row = await getExecutiveVoiceSessionForAdmin(db, sessionId, adminUserId);
  if (!row || row.status !== "active") return false;
  await db
    .update(executiveAgentVoiceSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(executiveAgentVoiceSessions.id, sessionId), eq(executiveAgentVoiceSessions.adminUserId, adminUserId)));
  return true;
}

export async function getExecutiveVoiceSessionForAdmin(
  db: MySql2Database<typeof schema>,
  sessionId: string,
  adminUserId: number
) {
  const [session] = await db
    .select()
    .from(executiveAgentVoiceSessions)
    .where(and(eq(executiveAgentVoiceSessions.id, sessionId), eq(executiveAgentVoiceSessions.adminUserId, adminUserId)))
    .limit(1);
  return session ?? null;
}

export async function listExecutiveVoiceTurnsForSession(
  db: MySql2Database<typeof schema>,
  sessionId: string,
  adminUserId: number,
  limit = 80
) {
  return db
    .select()
    .from(executiveAgentVoiceTurns)
    .where(
      and(eq(executiveAgentVoiceTurns.sessionId, sessionId), eq(executiveAgentVoiceTurns.adminUserId, adminUserId))
    )
    .orderBy(asc(executiveAgentVoiceTurns.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

/** Most recent turn in session (for voice follow-up intent), excluding the row about to be inserted. */
export async function getLatestExecutiveVoiceTurnForSession(
  db: MySql2Database<typeof schema>,
  sessionId: string,
  adminUserId: number,
) {
  const [row] = await db
    .select()
    .from(executiveAgentVoiceTurns)
    .where(and(eq(executiveAgentVoiceTurns.sessionId, sessionId), eq(executiveAgentVoiceTurns.adminUserId, adminUserId)))
    .orderBy(desc(executiveAgentVoiceTurns.createdAt))
    .limit(1);
  return row ?? null;
}

/** Recent voice / chat turns (orchestratorSource) for briefing — last 24h, newest first. */
export async function listExecutiveVoiceTurnsSinceForAdmin(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  since: Date,
  limit = 60
) {
  return db
    .select()
    .from(executiveAgentVoiceTurns)
    .where(and(eq(executiveAgentVoiceTurns.adminUserId, adminUserId), gte(executiveAgentVoiceTurns.createdAt, since)))
    .orderBy(desc(executiveAgentVoiceTurns.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}
