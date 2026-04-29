/**
 * CRM logging for widget (webchat) conversations.
 * Creates/finds contact + conversation, inserts messages, updates preview.
 */

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  crm_contacts,
  crm_conversations,
  crm_messages,
} from "@/lib/db/schema";
import { sanitizeTitle, sanitizeUrl } from "@/lib/widget/pii";

const WEBCHAT_CHANNEL = "webchat";

export interface WebChatLogParams {
  db: MySql2Database;
  userId: number;
  siteId: string;
  /** `client_accounts.id` for Revenue OS — must already be owned by `userId` (caller enforces). */
  crmClientId?: string | null;
  sessionId: string;
  pageUrl?: string;
  pageTitle?: string;
  userMessage: string;
  assistantReply: string;
  /** Shown in Client Hub inbox (customFields.sourceSiteName). */
  sourceSiteName?: string | null;
  /** Shown in Client Hub inbox (customFields.sourceAgentName). */
  sourceAgentName?: string | null;
}

function slugHost(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" ? "localhost" : h.replace(/\./g, "-");
  } catch {
    return "unknown";
  }
}

/** Exported for unit tests: merges CRM contact `customFields` (widget attribution, etc.). */
export function mergeCrmContactCustomFields(
  previous: unknown,
  patch: Record<string, string | null | undefined>,
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (previous && typeof previous === "object" && !Array.isArray(previous)) {
    base = { ...(previous as Record<string, unknown>) };
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) {
      delete base[k];
    } else {
      base[k] = v;
    }
  }
  return base;
}

export async function logWebChatMessage(params: WebChatLogParams): Promise<void> {
  const {
    db,
    userId,
    siteId,
    crmClientId,
    sessionId,
    pageUrl: rawUrl,
    pageTitle: rawTitle,
    userMessage,
    assistantReply,
    sourceSiteName,
    sourceAgentName,
  } = params;

  const pageUrl = sanitizeUrl(rawUrl) ?? undefined;
  const pageTitle = sanitizeTitle(rawTitle) ?? undefined;

  const hostSlug = pageUrl ? slugHost(pageUrl) : "unknown";
  const syntheticEmail = `webchat+${sessionId}@${hostSlug}.widget`;

  const tags = JSON.stringify(["webchat", `site:${siteId}`]);

  const customFieldsForHub = mergeCrmContactCustomFields(null, {
    sourceSiteName: sourceSiteName ?? `site:${siteId}`,
    sourceAgentName: sourceAgentName ?? undefined,
  });
  const customJson = Object.keys(customFieldsForHub).length
    ? JSON.stringify(customFieldsForHub)
    : null;

  let contactId: string;

  const existingContacts = await db
    .select()
    .from(crm_contacts)
    .where(
      and(
        eq(crm_contacts.userId, userId),
        eq(crm_contacts.email, syntheticEmail)
      )
    )
    .limit(1);

  if (existingContacts.length) {
    const row = existingContacts[0];
    contactId = row.id;
    const mergedCustom = mergeCrmContactCustomFields(
      row.customFields,
      customFieldsForHub as Record<string, string | null | undefined>,
    );
    const nextJson = JSON.stringify(mergedCustom);
    const rowCustomStr = typeof row.customFields === "string" ? row.customFields : null;
    const customChanged = rowCustomStr == null || nextJson !== rowCustomStr;
    const linkClient = Boolean(crmClientId && crmClientId !== row.clientId);
    if (linkClient || customChanged) {
      const patch: Record<string, unknown> = {
        customFields: nextJson,
        updatedAt: new Date(),
      };
      if (linkClient) {
        patch.clientId = crmClientId;
      }
      await db
        .update(crm_contacts)
        .set(patch as Record<string, unknown>)
        .where(eq(crm_contacts.id, contactId));
    }
  } else {
    contactId = crypto.randomUUID();
    await db.insert(crm_contacts).values({
      id: contactId,
      userId,
      workspaceId: null,
      email: syntheticEmail,
      firstName: "Website Visitor",
      lastName: null,
      phone: null,
      company: null,
      leadSource: "webchat",
      clientId: crmClientId ?? null,
      tags,
      customFields: customJson,
    } as any);
  }

  let conversationId: string;

  const existingConvs = await db
    .select({ id: crm_conversations.id, unreadCount: crm_conversations.unreadCount })
    .from(crm_conversations)
    .where(
      and(
        eq(crm_conversations.contactId, contactId),
        eq(crm_conversations.userId, userId),
        eq(crm_conversations.channel, WEBCHAT_CHANNEL)
      )
    )
    .limit(1);

  if (existingConvs.length) {
    conversationId = existingConvs[0].id;
    const newUnread = (existingConvs[0].unreadCount ?? 0) + 1;
    await db
      .update(crm_conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: userMessage.slice(0, 255),
        unreadCount: newUnread,
        updatedAt: new Date(),
      } as any)
      .where(eq(crm_conversations.id, conversationId));
  } else {
    conversationId = crypto.randomUUID();
    await db.insert(crm_conversations).values({
      id: conversationId,
      contactId,
      userId,
      workspaceId: null,
      channel: WEBCHAT_CHANNEL,
      status: "open",
      subject: pageTitle || pageUrl || "Web chat",
      lastMessageAt: new Date(),
      lastMessagePreview: userMessage.slice(0, 255),
      unreadCount: 1,
    } as any);
  }

  const userMsgId = crypto.randomUUID();
  const assistantMsgId = crypto.randomUUID();

  const pageMeta = pageUrl || pageTitle ? { url: pageUrl || null, title: pageTitle || null } : null;

  await db.insert(crm_messages).values({
    id: userMsgId,
    conversationId,
    direction: "inbound",
    channel: WEBCHAT_CHANNEL,
    content: userMessage,
    status: "received",
    metadata: pageMeta ? JSON.stringify(pageMeta) : null,
  } as any);

  await db.insert(crm_messages).values({
    id: assistantMsgId,
    conversationId,
    direction: "outbound",
    channel: WEBCHAT_CHANNEL,
    content: assistantReply,
    status: "received",
    metadata: null,
  } as any);

  await db
    .update(crm_conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: assistantReply.slice(0, 255),
      updatedAt: new Date(),
    } as any)
    .where(eq(crm_conversations.id, conversationId));
}
