import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientServiceStatus } from "@/lib/db/schema";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";

export async function getClientServiceStatusForOperator(
  userId: number,
  clientId: string,
): Promise<{
  status: string;
  pauseReason: string | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
} | null> {
  await ensureClientPortalTables();
  try {
    assertValidClientId(clientId);
  } catch {
    return null;
  }
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return null;
  const db = await getDb();
  const [row] = await db.select().from(clientServiceStatus).where(eq(clientServiceStatus.clientId, clientId)).limit(1);
  if (!row) {
    return { status: "active", pauseReason: null, pausedAt: null, resumedAt: null };
  }
  return {
    status: row.status ?? "active",
    pauseReason: row.pauseReason,
    pausedAt: row.pausedAt,
    resumedAt: row.resumedAt,
  };
}

export async function setClientServicePaused(
  userId: number,
  clientId: string,
  reason: string | null,
) {
  await ensureClientPortalTables();
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return { ok: false as const, error: "not_found" };
  const now = new Date();
  const db = await getDb();
  const ownerUserId = c.ownerUserId;
  const pauseReason = reason?.trim() ? reason.trim().slice(0, 512) : null;
  await db
    .insert(clientServiceStatus)
    .values({
      clientId,
      ownerUserId,
      status: "paused",
      pauseReason,
      pausedAt: now,
      resumedAt: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "paused",
        ownerUserId,
        pauseReason,
        pausedAt: now,
        resumedAt: null,
        updatedAt: now,
      },
    });
  await logClientPortalActivity(clientId, null, "service_paused", { byOperatorUserId: userId });
  return { ok: true as const };
}

export async function setClientServiceResumed(userId: number, clientId: string) {
  await ensureClientPortalTables();
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return { ok: false as const, error: "not_found" };
  const now = new Date();
  const db = await getDb();
  const ownerUserId = c.ownerUserId;
  await db
    .insert(clientServiceStatus)
    .values({
      clientId,
      ownerUserId,
      status: "active",
      pauseReason: null,
      pausedAt: null,
      resumedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "active",
        ownerUserId,
        pauseReason: null,
        pausedAt: null,
        resumedAt: now,
        updatedAt: now,
      },
    });
  await logClientPortalActivity(clientId, null, "service_resumed", { byOperatorUserId: userId });
  return { ok: true as const };
}
