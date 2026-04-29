/**
 * Webchat retention cleanup.
 * Deletes messages, conversations, and orphaned contacts per binding retention policy.
 */

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  aiAgentSiteBindings,
  crm_contacts,
  crm_conversations,
  crm_messages,
} from "@/lib/db/schema";

const WEBCHAT_CHANNEL = "webchat";

export interface RetentionCleanupResult {
  bindingsProcessed: number;
  messagesDeleted: number;
  conversationsDeleted: number;
  contactsDeleted: number;
  errors: string[];
}

function getAffectedRows(res: unknown): number {
  if (res && typeof res === "object" && "affectedRows" in res && typeof (res as { affectedRows?: number }).affectedRows === "number") {
    return (res as { affectedRows: number }).affectedRows;
  }
  if (Array.isArray(res) && res[0] && typeof res[0] === "object" && "affectedRows" in res[0]) {
    return (res[0] as { affectedRows: number }).affectedRows;
  }
  return 0;
}

/** Run retention cleanup for all bindings that have retentionDays in metadata. */
export async function runWebchatRetentionCleanup(db: MySql2Database): Promise<RetentionCleanupResult> {
  const result: RetentionCleanupResult = {
    bindingsProcessed: 0,
    messagesDeleted: 0,
    conversationsDeleted: 0,
    contactsDeleted: 0,
    errors: [],
  };

  const bindings = await db
    .select({ id: aiAgentSiteBindings.id, siteId: aiAgentSiteBindings.siteId, metadata: aiAgentSiteBindings.metadata })
    .from(aiAgentSiteBindings)
    .where(eq(aiAgentSiteBindings.isActive, true));

  for (const b of bindings) {
    let meta: Record<string, unknown> = {};
    try {
      if (b.metadata) {
        meta = typeof b.metadata === "string" ? JSON.parse(b.metadata) : (b.metadata as Record<string, unknown>);
      }
    } catch {
      continue;
    }
    const retentionDays = typeof meta.retentionDays === "number" && [7, 30, 90, 365].includes(meta.retentionDays)
      ? meta.retentionDays
      : null;
    if (!retentionDays) continue;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const siteTag = `site:${b.siteId}`;

      const contacts = await db
        .select({ id: crm_contacts.id })
        .from(crm_contacts)
        .where(
          and(
            sql`${crm_contacts.tags} LIKE ${`%"${siteTag}"%`}`,
            sql`(${crm_contacts.email} LIKE 'webchat+%' OR ${crm_contacts.tags} LIKE '%"webchat"%')`
          )
        );

      const contactIds = contacts.map((c) => c.id).filter(Boolean);
      if (contactIds.length === 0) {
        result.bindingsProcessed++;
        continue;
      }

      const convos = await db
        .select({ id: crm_conversations.id })
        .from(crm_conversations)
        .where(
          and(
            eq(crm_conversations.channel, WEBCHAT_CHANNEL),
            inArray(crm_conversations.contactId, contactIds)
          )
        );

      const convoIds = convos.map((c) => c.id).filter(Boolean);
      if (convoIds.length === 0) {
        result.bindingsProcessed++;
        continue;
      }

      const msgRes = await db
        .delete(crm_messages)
        .where(
          and(
            inArray(crm_messages.conversationId, convoIds),
            lt(crm_messages.createdAt, cutoff)
          )
        );
      result.messagesDeleted += getAffectedRows(msgRes);

      const convosWithMessages = await db
        .select({ conversationId: crm_messages.conversationId })
        .from(crm_messages)
        .where(inArray(crm_messages.conversationId, convoIds));
      const convoIdsWithMessages = [...new Set(convosWithMessages.map((r) => r.conversationId))];
      const emptyConvoIds = convoIds.filter((id) => !convoIdsWithMessages.includes(id));
      if (emptyConvoIds.length > 0) {
        const convRes = await db.delete(crm_conversations).where(inArray(crm_conversations.id, emptyConvoIds));
        result.conversationsDeleted += getAffectedRows(convRes);
      }

      const contactsWithConvos = await db
        .select({ contactId: crm_conversations.contactId })
        .from(crm_conversations)
        .where(inArray(crm_conversations.contactId, contactIds));
      const contactIdsWithConvos = [...new Set(contactsWithConvos.map((r) => r.contactId).filter(Boolean))];
      const orphanContactIds = contactIds.filter((id) => !contactIdsWithConvos.includes(id));
      if (orphanContactIds.length > 0) {
        const contactRes = await db
          .delete(crm_contacts)
          .where(
            and(
              inArray(crm_contacts.id, orphanContactIds),
              sql`${crm_contacts.email} LIKE 'webchat+%'`
            )
          );
        result.contactsDeleted += getAffectedRows(contactRes);
      }

      result.bindingsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Binding ${b.id} (site ${b.siteId}): ${msg}`);
    }
  }

  return result;
}
