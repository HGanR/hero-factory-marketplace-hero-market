import "server-only";

import { and, count, eq, gte, isNotNull, isNull, max, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { aiAgents, crm_conversations, oasisNpcMessages, oasisNpcSessions, socialEngagementThreads, widgetConversations } from "@/lib/db/schema";
import {
  EXECUTIVE_AGENT_KEYS,
  type AgentIntelligenceRecord,
  type ExecutiveAgentKey,
  createDefaultAgentIntelligenceRecords,
} from "@/lib/executive-agent/agent-intelligence-bus";

type Db = MySql2Database<typeof schema>;

async function widgetPersonaStats(
  db: Db,
  persona: Exclude<ExecutiveAgentKey, "executive_admin">,
): Promise<{ active: number; total: number; lastAt: Date | null } | null> {
  try {
    const nameMatch =
      persona === "reality"
        ? sql`LOWER(${aiAgents.name}) LIKE '%reality%'`
        : persona === "eleanor"
          ? sql`LOWER(${aiAgents.name}) LIKE '%eleanor%'`
          : persona === "bentley"
            ? sql`LOWER(${aiAgents.name}) LIKE '%bentley%'`
            : sql`LOWER(${aiAgents.name}) LIKE '%skipper%'`;

    const base = and(isNotNull(widgetConversations.agentId), eq(widgetConversations.agentId, aiAgents.id), nameMatch);

    const [activeRow] = await db
      .select({ n: count() })
      .from(widgetConversations)
      .innerJoin(aiAgents, eq(widgetConversations.agentId, aiAgents.id))
      .where(and(base, eq(widgetConversations.status, "active")));

    const [totalRow] = await db
      .select({ n: count() })
      .from(widgetConversations)
      .innerJoin(aiAgents, eq(widgetConversations.agentId, aiAgents.id))
      .where(base);

    const [lastRow] = await db
      .select({ m: max(widgetConversations.lastMessageAt) })
      .from(widgetConversations)
      .innerJoin(aiAgents, eq(widgetConversations.agentId, aiAgents.id))
      .where(base);

    return {
      active: Number(activeRow?.n ?? 0),
      total: Number(totalRow?.n ?? 0),
      lastAt: lastRow?.m ?? null,
    };
  } catch {
    return null;
  }
}

async function npcLandStats(db: Db): Promise<{ activeSessions: number; messages30d: number; lastAt: Date | null } | null> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeSess] = await db.select({ n: count() }).from(oasisNpcSessions).where(isNull(oasisNpcSessions.endedAt));
    const [msgs] = await db
      .select({ n: count() })
      .from(oasisNpcMessages)
      .where(gte(oasisNpcMessages.createdAt, since));
    const [last] = await db.select({ m: max(oasisNpcMessages.createdAt) }).from(oasisNpcMessages);
    return {
      activeSessions: Number(activeSess?.n ?? 0),
      messages30d: Number(msgs?.n ?? 0),
      lastAt: last?.m ?? null,
    };
  } catch {
    return null;
  }
}

async function executiveSocialStats(db: Db): Promise<{ active: number; total: number; lastAt: Date | null } | null> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeRow] = await db
      .select({ n: count() })
      .from(socialEngagementThreads)
      .where(gte(socialEngagementThreads.lastMessageAt, since));

    const [totalRow] = await db.select({ n: count() }).from(socialEngagementThreads);

    const [lastRow] = await db.select({ m: max(socialEngagementThreads.lastMessageAt) }).from(socialEngagementThreads);

    return {
      active: Number(activeRow?.n ?? 0),
      total: Number(totalRow?.n ?? 0),
      lastAt: lastRow?.m ?? null,
    };
  } catch {
    return null;
  }
}

async function crmThreadStats(db: Db): Promise<{ total: number; lastAt: Date | null } | null> {
  try {
    const [totalRow] = await db.select({ n: count() }).from(crm_conversations);
    const [lastRow] = await db.select({ m: max(crm_conversations.lastMessageAt) }).from(crm_conversations);
    return { total: Number(totalRow?.n ?? 0), lastAt: lastRow?.m ?? null };
  } catch {
    return null;
  }
}

/**
 * Loads per-persona intelligence from known tables. Widget persona split uses `ai_agents.name` heuristics → partial.
 */
export async function loadAgentIntelligenceFromDatabase(db: Db): Promise<AgentIntelligenceRecord[]> {
  const base = createDefaultAgentIntelligenceRecords();
  const byKey = Object.fromEntries(base.map((r) => [r.agentKey, { ...r }])) as Record<ExecutiveAgentKey, AgentIntelligenceRecord>;

  const social = await executiveSocialStats(db);
  const crm = await crmThreadStats(db);

  for (const persona of ["reality", "eleanor", "bentley", "skipper"] as const) {
    const w = await widgetPersonaStats(db, persona);
    const row = byKey[persona];
    if (w) {
      row.activeConversations = w.active;
      row.totalConversations = w.total;
      row.lastActivityAt = w.lastAt ? w.lastAt.toISOString() : null;
      row.source = "partial";
      row.note =
        "Widget conversations joined to `ai_agents` with case-insensitive name match — verify agent naming in your workspace.";
      row.status = w.active > 0 ? "online" : "unknown";
    }
  }

  const ex = byKey.executive_admin;
  if (social) {
    ex.activeConversations = social.active;
    ex.totalConversations = social.total;
    const dates = [social.lastAt, crm?.lastAt].filter((d): d is Date => d instanceof Date);
    const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : social.lastAt;
    ex.lastActivityAt = last ? last.toISOString() : null;
    ex.source = crm ? "partial" : "db";
    ex.note =
      "Rolls up `social_engagement_threads` (7d window for active) and optionally CRM conversation totals — not a single chatbot persona.";
    ex.status = social.active > 0 ? "online" : "unknown";
  } else if (crm) {
    ex.totalConversations = crm.total;
    ex.lastActivityAt = crm.lastAt ? crm.lastAt.toISOString() : null;
    ex.source = "partial";
    ex.note = "Social engagement tables unavailable — CRM conversation totals only.";
  }

  const sk = byKey.skipper;
  const npc = await npcLandStats(db);
  if (npc && (npc.messages30d > 0 || npc.activeSessions > 0)) {
    sk.activeConversations = npc.activeSessions;
    sk.totalConversations = npc.messages30d;
    sk.lastActivityAt = npc.lastAt ? npc.lastAt.toISOString() : null;
    sk.source = "db";
    sk.note =
      "SKIPPER aggregates OASIS NPC sessions/messages (30d message window, open sessions for active) — executive cross-NPC visibility.";
    sk.status = npc.activeSessions > 0 ? "online" : "unknown";
  }

  return [...EXECUTIVE_AGENT_KEYS].map((k) => byKey[k]);
}
