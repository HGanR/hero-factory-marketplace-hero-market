import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientPortalRequests } from "@/lib/db/schema";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import type { ClientPortalSessionState } from "@/lib/client-portal/portal-session";

export const REQUEST_TYPES = [
  "ai_issue",
  "website_change",
  "business_info",
  "faq_update",
  "contact_update",
  "other",
] as const;
export type ClientRequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ["open", "reviewing", "completed", "rejected"] as const;
export type ClientRequestStatus = (typeof REQUEST_STATUSES)[number];

export type ClientPortalRequestRow = typeof clientPortalRequests.$inferSelect;

function toType(v: unknown): ClientRequestType {
  return REQUEST_TYPES.includes(v as ClientRequestType) ? (v as ClientRequestType) : "other";
}

function toStatus(v: unknown): ClientRequestStatus {
  return REQUEST_STATUSES.includes(v as ClientRequestStatus) ? (v as ClientRequestStatus) : "open";
}

export async function createClientPortalRequest(
  s: ClientPortalSessionState,
  body: {
    type?: unknown;
    title?: unknown;
    description?: unknown;
    relatedConversationId?: unknown;
    relatedAgentId?: unknown;
    relatedSiteId?: unknown;
  },
) {
  const title = String(body.title ?? "").trim().slice(0, 200);
  const description = String(body.description ?? "").trim().slice(0, 5000);
  if (!title || !description) {
    throw new Error("title and description required");
  }
  await ensureClientPortalTables();
  const db = await getDb();
  const id = randomUUID();
  await db.insert(clientPortalRequests).values({
    id,
    clientId: s.tokenPayload.clientId,
    portalUserId: s.portalUser.id,
    ownerUserId: s.tokenPayload.ownerUserId,
    type: toType(body.type),
    title,
    description,
    relatedConversationId:
      typeof body.relatedConversationId === "string" && body.relatedConversationId.trim()
        ? body.relatedConversationId.trim().slice(0, 36)
        : null,
    relatedAgentId:
      typeof body.relatedAgentId === "string" && body.relatedAgentId.trim()
        ? body.relatedAgentId.trim().slice(0, 36)
        : null,
    relatedSiteId:
      typeof body.relatedSiteId === "string" && body.relatedSiteId.trim()
        ? body.relatedSiteId.trim().slice(0, 36)
        : null,
    status: "open",
    operatorNote: null,
  });
  await logClientPortalActivity(s.client.id, s.portalUser.id, "request_created", { requestId: id });
  return id;
}

export async function listClientPortalRequests(s: ClientPortalSessionState, limit = 100) {
  await ensureClientPortalTables();
  const db = await getDb();
  return db
    .select()
    .from(clientPortalRequests)
    .where(
      and(
        eq(clientPortalRequests.clientId, s.tokenPayload.clientId),
        eq(clientPortalRequests.ownerUserId, s.tokenPayload.ownerUserId),
      ),
    )
    .orderBy(desc(clientPortalRequests.createdAt))
    .limit(limit);
}

export async function getClientPortalRequestById(s: ClientPortalSessionState, requestId: string) {
  await ensureClientPortalTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(clientPortalRequests)
    .where(
      and(
        eq(clientPortalRequests.id, requestId),
        eq(clientPortalRequests.clientId, s.tokenPayload.clientId),
        eq(clientPortalRequests.ownerUserId, s.tokenPayload.ownerUserId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listOperatorRequests(userId: number, clientId: string, limit = 200) {
  await ensureClientPortalTables();
  const db = await getDb();
  return db
    .select()
    .from(clientPortalRequests)
    .where(and(eq(clientPortalRequests.ownerUserId, userId), eq(clientPortalRequests.clientId, clientId)))
    .orderBy(desc(clientPortalRequests.createdAt))
    .limit(limit);
}

export async function updateOperatorRequestStatus(
  userId: number,
  clientId: string,
  requestId: string,
  patch: { status?: unknown; operatorNote?: unknown },
) {
  await ensureClientPortalTables();
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(clientPortalRequests)
    .where(
      and(
        eq(clientPortalRequests.id, requestId),
        eq(clientPortalRequests.clientId, clientId),
        eq(clientPortalRequests.ownerUserId, userId),
      ),
    )
    .limit(1);
  if (!existing) return null;

  const nextStatus =
    patch.status === undefined ? (existing.status as ClientRequestStatus) : toStatus(patch.status);
  const nextNote =
    patch.operatorNote === undefined
      ? existing.operatorNote
      : String(patch.operatorNote ?? "")
          .trim()
          .slice(0, 2000) || null;

  await db
    .update(clientPortalRequests)
    .set({
      status: nextStatus,
      operatorNote: nextNote,
      updatedAt: new Date(),
    })
    .where(eq(clientPortalRequests.id, existing.id));

  if (nextStatus !== existing.status) {
    await logClientPortalActivity(clientId, null, "request_status_updated", {
      requestId: existing.id,
      from: existing.status,
      to: nextStatus,
    });
  }

  const [updated] = await db
    .select()
    .from(clientPortalRequests)
    .where(eq(clientPortalRequests.id, existing.id))
    .limit(1);
  return updated ?? null;
}
