import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  aiAgents,
  crm_conversations,
  socialEngagementMessages,
  socialEngagementThreads,
  widgetConversations,
  widgetMessages,
} from "@/lib/db/schema";
import type { ExecutiveAgentKey } from "@/lib/executive-agent/agent-intelligence-bus";
import { maskSnippet, maskUserIdLabel, maskVisitorLabel } from "@/lib/executive-agent/executive-admin-masking";

type Db = MySql2Database<typeof schema>;

export type RecentConversationItem = {
  id: string;
  agentKey: ExecutiveAgentKey | "unmapped";
  displayName: string;
  clientId: string | null;
  userLabel: string;
  snippet: string;
  lastMessageAt: string;
  source: string;
};

function personaFromAgentName(name: string | null | undefined): ExecutiveAgentKey | "unmapped" {
  const n = (name ?? "").toLowerCase();
  if (n.includes("reality")) return "reality";
  if (n.includes("eleanor")) return "eleanor";
  if (n.includes("bentley")) return "bentley";
  if (n.includes("skipper")) return "skipper";
  return "unmapped";
}

export async function loadRecentConversationsForExecutive(db: Db, limit = 24): Promise<RecentConversationItem[]> {
  const out: RecentConversationItem[] = [];

  try {
    const wcRows = await db
      .select({
        id: widgetConversations.id,
        lastMessageAt: widgetConversations.lastMessageAt,
        visitorId: widgetConversations.visitorId,
        ownerUserId: widgetConversations.ownerUserId,
        agentName: aiAgents.name,
      })
      .from(widgetConversations)
      .leftJoin(aiAgents, eq(widgetConversations.agentId, aiAgents.id))
      .orderBy(desc(widgetConversations.lastMessageAt))
      .limit(Math.ceil(limit / 3));

    const wcIds = wcRows.map((r) => r.id);
    const lastMsgs =
      wcIds.length === 0
        ? []
        : await db
            .select({
              conversationId: widgetMessages.conversationId,
              contentText: widgetMessages.contentText,
              createdAt: widgetMessages.createdAt,
            })
            .from(widgetMessages)
            .where(inArray(widgetMessages.conversationId, wcIds))
            .orderBy(desc(widgetMessages.createdAt));

    const latestByConv = new Map<string, { text: string; at: Date }>();
    for (const m of lastMsgs) {
      if (!latestByConv.has(m.conversationId)) {
        latestByConv.set(m.conversationId, { text: m.contentText, at: m.createdAt });
      }
    }

    for (const r of wcRows) {
      const lm = latestByConv.get(r.id);
      const persona = personaFromAgentName(r.agentName);
      out.push({
        id: `widget:${r.id}`,
        agentKey: persona === "unmapped" ? "unmapped" : persona,
        displayName: r.agentName?.trim() || "Widget agent",
        clientId: null,
        userLabel: r.ownerUserId != null ? maskUserIdLabel(r.ownerUserId) : maskVisitorLabel(r.visitorId),
        snippet: maskSnippet(lm?.text ?? ""),
        lastMessageAt: (lm?.at ?? r.lastMessageAt ?? new Date()).toISOString(),
        source: "widget_conversations",
      });
    }
  } catch {
    /* table may be missing */
  }

  try {
    const crmRows = await db
      .select({
        id: crm_conversations.id,
        lastMessageAt: crm_conversations.lastMessageAt,
        preview: crm_conversations.lastMessagePreview,
        userId: crm_conversations.userId,
      })
      .from(crm_conversations)
      .orderBy(desc(crm_conversations.lastMessageAt))
      .limit(Math.ceil(limit / 3));

    for (const r of crmRows) {
      out.push({
        id: `crm:${r.id}`,
        agentKey: "executive_admin",
        displayName: "CRM thread",
        clientId: null,
        userLabel: maskUserIdLabel(r.userId ?? null),
        snippet: maskSnippet(r.preview ?? ""),
        lastMessageAt: (r.lastMessageAt ?? new Date()).toISOString(),
        source: "crm_conversations",
      });
    }
  } catch {
    /* */
  }

  try {
    const th = await db
      .select({
        id: socialEngagementThreads.id,
        lastMessageAt: socialEngagementThreads.lastMessageAt,
        clientId: socialEngagementThreads.clientId,
      })
      .from(socialEngagementThreads)
      .orderBy(desc(socialEngagementThreads.lastMessageAt))
      .limit(Math.ceil(limit / 3));

    const tids = th.map((t) => t.id);
    const msgs =
      tids.length === 0
        ? []
        : await db
            .select({
              threadId: socialEngagementMessages.threadId,
              text: socialEngagementMessages.messageText,
              createdAt: socialEngagementMessages.createdAt,
            })
            .from(socialEngagementMessages)
            .where(inArray(socialEngagementMessages.threadId, tids))
            .orderBy(desc(socialEngagementMessages.createdAt));

    const latestByThread = new Map<string, { text: string | null; at: Date }>();
    for (const m of msgs) {
      if (!latestByThread.has(m.threadId)) {
        latestByThread.set(m.threadId, { text: m.text, at: m.createdAt });
      }
    }

    for (const r of th) {
      const lm = latestByThread.get(r.id);
      out.push({
        id: `social:${r.id}`,
        agentKey: "executive_admin",
        displayName: "Engagement thread",
        clientId: r.clientId && r.clientId.length > 0 ? r.clientId : null,
        userLabel: "Channel",
        snippet: maskSnippet(lm?.text ?? ""),
        lastMessageAt: (lm?.at ?? r.lastMessageAt ?? new Date()).toISOString(),
        source: "social_engagement_threads",
      });
    }
  } catch {
    /* */
  }

  out.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  return out.slice(0, limit);
}
