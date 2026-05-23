import "server-only";

import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { oasisNpcMessages, oasisNpcSessions, oasisNpcs } from "@/lib/db/schema";
import {
  EVAANA_NPC_ID,
  TROOTHERTZ_BUILDING_ID,
  TROO_TOWN_WORLD_ID,
} from "@/lib/executive-agent/troo-town-evana-constants";
import type { TrooTownEvanaOverviewDto } from "@/lib/executive-agent/troo-town-evana-types";
import { maskSnippet, maskUserIdLabel, maskVisitorLabel } from "@/lib/executive-agent/executive-admin-masking";

type Db = MySql2Database<typeof schema>;

const FOLLOW_UP_KEYWORDS = [
  "follow up",
  "follow-up",
  "call me",
  "email me",
  "contact",
  "interested",
  "schedule",
  "appointment",
  "demo",
  "pricing",
  "help me",
  "question",
];

function visitorLabel(userId: number | null, sessionId: string): string {
  if (userId != null) return maskUserIdLabel(userId);
  return maskVisitorLabel(sessionId);
}

function deriveFollowUpHint(snippet: string, topic: string | null): string | null {
  const blob = `${topic ?? ""} ${snippet}`.toLowerCase();
  for (const kw of FOLLOW_UP_KEYWORDS) {
    if (blob.includes(kw)) {
      return `Visitor signal: "${kw}" — Skipper may propose a governed follow-up note or approval.`;
    }
  }
  if (snippet.trim().length >= 40) {
    return "Conversation has substance — review for executive follow-up.";
  }
  return null;
}

async function resolveEvaanaNpc(db: Db) {
  const npcFields = {
    id: oasisNpcs.id,
    npcId: oasisNpcs.npcId,
    name: oasisNpcs.name,
    buildingId: oasisNpcs.buildingId,
  };

  const byCanonical = await db
    .select(npcFields)
    .from(oasisNpcs)
    .where(
      and(
        eq(oasisNpcs.npcId, EVAANA_NPC_ID),
        eq(oasisNpcs.worldId, TROO_TOWN_WORLD_ID),
        eq(oasisNpcs.isActive, true)
      )
    )
    .limit(1);

  if (byCanonical[0]) return byCanonical[0];

  const byBuilding = await db
    .select(npcFields)
    .from(oasisNpcs)
    .where(
      and(
        eq(oasisNpcs.worldId, TROO_TOWN_WORLD_ID),
        eq(oasisNpcs.buildingId, TROOTHERTZ_BUILDING_ID),
        eq(oasisNpcs.isActive, true),
        or(
          eq(oasisNpcs.npcId, EVAANA_NPC_ID),
          sql`LOWER(${oasisNpcs.name}) LIKE '%evaana%'`,
          sql`LOWER(${oasisNpcs.name}) LIKE '%evana%'`
        )
      )
    )
    .limit(1);

  if (byBuilding[0]) return byBuilding[0];

  const byNpcId = await db
    .select(npcFields)
    .from(oasisNpcs)
    .where(and(eq(oasisNpcs.npcId, EVAANA_NPC_ID), eq(oasisNpcs.isActive, true)))
    .limit(1);

  return byNpcId[0] ?? null;
}

export async function buildTrooTownEvanaOverview(
  db: Db,
  input?: { sessionLimit?: number }
): Promise<TrooTownEvanaOverviewDto> {
  const sessionLimit = Math.min(Math.max(input?.sessionLimit ?? 24, 1), 60);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const evaana = await resolveEvaanaNpc(db);
  if (!evaana) {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      worldId: TROO_TOWN_WORLD_ID,
      worldLabel: "TROO TOWN",
      buildingId: TROOTHERTZ_BUILDING_ID,
      buildingLabel: "TROOTHHERTZ LLC",
      npcConfigured: false,
      npcId: EVAANA_NPC_ID,
      npcName: null,
      totals: { sessions30d: 0, messages30d: 0, activeSessions: 0 },
      sessions: [],
      skipperBrief:
        "Evaana (troothhertz-evaana) was not found in OASIS for green-terrain / troothhertz-tower. She should be seeded from the TROOTHHERTZ LLC building — check Admin → NPC, then visitor chats from /troo-town will appear here for Skipper follow-up intelligence.",
      followUpThemes: [],
      meta: {
        readOnly: true,
        piiMasked: true,
        skipperCanAccessTranscripts: true,
      },
    };
  }

  const sessions = await db
    .select({
      id: oasisNpcSessions.id,
      sessionId: oasisNpcSessions.sessionId,
      userId: oasisNpcSessions.userId,
      currentTopic: oasisNpcSessions.currentTopic,
      messageCount: oasisNpcSessions.messageCount,
      startedAt: oasisNpcSessions.startedAt,
      lastActivity: oasisNpcSessions.lastActivity,
      endedAt: oasisNpcSessions.endedAt,
    })
    .from(oasisNpcSessions)
    .where(and(eq(oasisNpcSessions.npcId, evaana.id), gte(oasisNpcSessions.lastActivity, since)))
    .orderBy(desc(oasisNpcSessions.lastActivity))
    .limit(sessionLimit);

  const sessionRowIds = sessions.map((s) => s.id);
  const latestBySession = new Map<number, { content: string; role: string }>();

  if (sessionRowIds.length > 0) {
    const msgs = await db
      .select({
        sessionId: oasisNpcMessages.sessionId,
        role: oasisNpcMessages.role,
        content: oasisNpcMessages.content,
        createdAt: oasisNpcMessages.createdAt,
      })
      .from(oasisNpcMessages)
      .where(inArray(oasisNpcMessages.sessionId, sessionRowIds))
      .orderBy(desc(oasisNpcMessages.createdAt));

    for (const m of msgs) {
      if (!latestBySession.has(m.sessionId)) {
        latestBySession.set(m.sessionId, { content: m.content, role: m.role });
      }
    }
  }

  const [msgCountRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(oasisNpcMessages)
    .innerJoin(oasisNpcSessions, eq(oasisNpcMessages.sessionId, oasisNpcSessions.id))
    .where(and(eq(oasisNpcSessions.npcId, evaana.id), gte(oasisNpcMessages.createdAt, since)));

  const activeSessions = sessions.filter((s) => s.endedAt == null).length;

  const sessionRows = sessions.map((s) => {
    const last = latestBySession.get(s.id);
    const snippet = maskSnippet(last?.content ?? "");
    const followUpHint = deriveFollowUpHint(snippet, s.currentTopic);
    return {
      sessionId: s.sessionId,
      sessionRowId: s.id,
      startedAt: new Date(s.startedAt as unknown as string).toISOString(),
      lastActivity: new Date(s.lastActivity as unknown as string).toISOString(),
      messageCount: s.messageCount,
      visitorLabel: visitorLabel(s.userId, s.sessionId),
      topic: s.currentTopic,
      lastSnippet: snippet,
      followUpHint,
    };
  });

  const followUpThemes = sessionRows
    .filter((s) => s.followUpHint)
    .slice(0, 6)
    .map((s) => s.topic?.trim() || s.lastSnippet.slice(0, 72) || "Visitor thread");

  const skipperBrief =
    sessions.length === 0
      ? `${evaana.name} is live in TROOTHHERTZ LLC on TROO TOWN — no visitor sessions in the last 30 days yet.`
      : `${evaana.name}: ${sessions.length} session(s) (30d), ${Number(msgCountRow?.n ?? 0)} message(s). ${followUpThemes.length} thread(s) flagged for follow-up review. Skipper can read masked snippets and propose governed follow-ups — no autonomous outreach.`;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    worldId: TROO_TOWN_WORLD_ID,
    worldLabel: "TROO TOWN",
    buildingId: evaana.buildingId ?? TROOTHERTZ_BUILDING_ID,
    buildingLabel: "TROOTHHERTZ LLC",
    npcConfigured: true,
    npcId: evaana.npcId,
    npcName: evaana.name,
    totals: {
      sessions30d: sessions.length,
      messages30d: Number(msgCountRow?.n ?? 0),
      activeSessions,
    },
    sessions: sessionRows,
    skipperBrief,
    followUpThemes,
    meta: {
      readOnly: true,
      piiMasked: true,
      skipperCanAccessTranscripts: true,
    },
  };
}
