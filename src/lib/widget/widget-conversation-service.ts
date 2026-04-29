import crypto from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { ensureWidgetConversationTables } from "@/lib/db/widget-conversation-ensure";
import { widgetConversations, widgetMessages } from "@/lib/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

export type WidgetMessageRole = "user" | "assistant" | "system";
export type WidgetMessagePersistStatus = "ok" | "error" | "blocked";

export function extractOriginHost(originHeader: string, refererHeader: string): string | null {
  const parse = (s: string): string | null => {
    const t = s.trim();
    if (!t) return null;
    try {
      return new URL(t).hostname.toLowerCase().slice(0, 255) || null;
    } catch {
      return null;
    }
  };
  return parse(originHeader) ?? parse(refererHeader);
}

export async function getOrResumeWidgetConversation(
  db: Db,
  params: {
    bindingId: string;
    widgetKey: string;
    siteId: string | null;
    agentId: string;
    ownerUserId: number;
    siteVersionIdSnapshot: string | null;
    providerStrategy: string;
    publicConversationIdFromClient: string | null | undefined;
    sessionId: string | null;
    originHost: string | null;
    visitorId: string | null;
  },
): Promise<{ internalId: string; publicId: string; resumed: boolean }> {
  await ensureWidgetConversationTables(db);
  const pubIn = params.publicConversationIdFromClient?.trim();
  if (pubIn) {
    const [existing] = await db
      .select()
      .from(widgetConversations)
      .where(
        and(
          eq(widgetConversations.publicConversationId, pubIn),
          eq(widgetConversations.widgetBindingId, params.bindingId),
          eq(widgetConversations.status, "active"),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(widgetConversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(widgetConversations.id, existing.id));
      return { internalId: existing.id, publicId: existing.publicConversationId, resumed: true };
    }
  }

  const internalId = crypto.randomUUID();
  const publicId = crypto.randomBytes(24).toString("base64url");
  await db.insert(widgetConversations).values({
    id: internalId,
    widgetBindingId: params.bindingId,
    widgetKeySnapshot: params.widgetKey.slice(0, 48),
    siteId: params.siteId,
    siteVersionId: params.siteVersionIdSnapshot,
    agentId: params.agentId,
    ownerUserId: params.ownerUserId,
    publicConversationId: publicId,
    status: "active",
    sessionId: params.sessionId?.trim().slice(0, 128) || null,
    originHost: params.originHost,
    visitorId: params.visitorId?.trim().slice(0, 64) || null,
    providerStrategySnapshot: params.providerStrategy.slice(0, 32),
    metadataJson: null,
  } as Record<string, unknown>);

  return { internalId, publicId, resumed: false };
}

export async function appendWidgetMessage(
  db: Db,
  params: {
    conversationInternalId: string;
    role: WidgetMessageRole;
    contentText: string;
    providerStrategySnapshot?: string | null;
    modelSnapshot?: string | null;
    status?: WidgetMessagePersistStatus;
    errorCode?: string | null;
    latencyMs?: number | null;
    metadataJson?: unknown;
  },
): Promise<void> {
  await ensureWidgetConversationTables(db);
  const text = params.contentText.slice(0, 500_000);
  await db.insert(widgetMessages).values({
    id: crypto.randomUUID(),
    conversationId: params.conversationInternalId,
    role: params.role,
    contentText: text,
    providerStrategySnapshot: params.providerStrategySnapshot?.slice(0, 32) ?? null,
    modelSnapshot: params.modelSnapshot?.slice(0, 128) ?? null,
    tokenUsageJson: null,
    latencyMs: params.latencyMs ?? null,
    status: params.status ?? "ok",
    errorCode: params.errorCode?.slice(0, 64) ?? null,
    metadataJson: params.metadataJson ?? null,
  } as Record<string, unknown>);

  await db
    .update(widgetConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(widgetConversations.id, params.conversationInternalId));
}

export async function listWidgetConversationsForSite(
  db: Db,
  siteId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    publicConversationId: string;
    agentId: string | null;
    status: string;
    lastMessageAt: Date | null;
    startedAt: Date | null;
    widgetKeySnapshot: string;
    providerStrategySnapshot: string | null;
  }>
> {
  await ensureWidgetConversationTables(db);
  const rows = await db
    .select({
      id: widgetConversations.id,
      publicConversationId: widgetConversations.publicConversationId,
      agentId: widgetConversations.agentId,
      status: widgetConversations.status,
      lastMessageAt: widgetConversations.lastMessageAt,
      startedAt: widgetConversations.startedAt,
      widgetKeySnapshot: widgetConversations.widgetKeySnapshot,
      providerStrategySnapshot: widgetConversations.providerStrategySnapshot,
    })
    .from(widgetConversations)
    .where(eq(widgetConversations.siteId, siteId))
    .orderBy(desc(widgetConversations.lastMessageAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows;
}

export async function getWidgetConversationForSiteByPublicId(
  db: Db,
  siteId: string,
  publicConversationId: string,
): Promise<{ conversation: typeof widgetConversations.$inferSelect } | null> {
  await ensureWidgetConversationTables(db);
  const [row] = await db
    .select()
    .from(widgetConversations)
    .where(
      and(
        eq(widgetConversations.siteId, siteId),
        eq(widgetConversations.publicConversationId, publicConversationId.trim()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { conversation: row };
}

export async function listWidgetMessagesForConversation(
  db: Db,
  conversationInternalId: string,
  limit: number,
): Promise<Array<typeof widgetMessages.$inferSelect>> {
  await ensureWidgetConversationTables(db);
  return db
    .select()
    .from(widgetMessages)
    .where(eq(widgetMessages.conversationId, conversationInternalId))
    .orderBy(asc(widgetMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
