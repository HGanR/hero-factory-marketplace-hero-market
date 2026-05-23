import "server-only";

import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { oasisNpcMessages, oasisNpcSessions, oasisNpcs } from "@/lib/db/schema";
import {
  SITE_BUILDER_ENGINE_ID,
  STEPHON_NPC_ID,
  STEPHON_WORLD_ID,
} from "@/lib/executive-agent/stephon-site-builder-constants";
import type { StephonSiteBuilderOverviewDto } from "@/lib/executive-agent/stephon-site-builder-types";
import { maskSnippet, maskUserIdLabel } from "@/lib/executive-agent/executive-admin-masking";
import { STEPHON_DISPLAY_NAME } from "@/lib/site-builder/stephon-persona";

type Db = MySql2Database<typeof schema>;

const USABILITY_KEYWORDS = [
  "confused",
  "stuck",
  "can't find",
  "cannot find",
  "how do i",
  "how do I",
  "not working",
  "doesn't work",
  "doesnt work",
  "error",
  "frustrated",
  "unclear",
  "hard to use",
  "where is",
  "lost",
  "help me",
  "doesn't make sense",
];

function operatorLabel(userId: number | null, sessionId: string): string {
  if (userId != null) return maskUserIdLabel(userId);
  const siteHint = sessionId.startsWith("sb-") ? sessionId.slice(3, 11) : sessionId.slice(0, 8);
  return `Builder · ${siteHint}…`;
}

function siteLabelFromTopic(topic: string | null, sessionId: string): string {
  if (topic?.trim()) {
    const t = topic.trim();
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  }
  if (sessionId.startsWith("sb-draft-")) return "Draft session";
  if (sessionId.startsWith("sb-")) return `Site ${sessionId.slice(3, 11)}…`;
  return "Site Builder session";
}

function deriveUsabilityHint(snippet: string, topic: string | null): string | null {
  const blob = `${topic ?? ""} ${snippet}`.toLowerCase();
  for (const kw of USABILITY_KEYWORDS) {
    if (blob.includes(kw.toLowerCase())) {
      return `Usability signal: "${kw}" — Skipper may recommend engine or UX improvements (advisory only).`;
    }
  }
  if (snippet.trim().length >= 48) {
    return "Substantive builder dialogue — review for product usability patterns.";
  }
  return null;
}

async function resolveStephonNpc(db: Db) {
  const fields = {
    id: oasisNpcs.id,
    npcId: oasisNpcs.npcId,
    name: oasisNpcs.name,
  };

  const byId = await db
    .select(fields)
    .from(oasisNpcs)
    .where(
      and(
        eq(oasisNpcs.npcId, STEPHON_NPC_ID),
        eq(oasisNpcs.isActive, true),
        or(eq(oasisNpcs.worldId, STEPHON_WORLD_ID), sql`${oasisNpcs.worldId} IS NULL`)
      )
    )
    .limit(1);

  if (byId[0]) return byId[0];

  const byName = await db
    .select(fields)
    .from(oasisNpcs)
    .where(
      and(
        eq(oasisNpcs.isActive, true),
        or(
          eq(oasisNpcs.npcId, STEPHON_NPC_ID),
          sql`LOWER(${oasisNpcs.name}) LIKE '%stephon%'`
        )
      )
    )
    .limit(1);

  return byName[0] ?? null;
}

export async function buildStephonSiteBuilderOverview(
  db: Db,
  input?: { sessionLimit?: number }
): Promise<StephonSiteBuilderOverviewDto> {
  const sessionLimit = Math.min(Math.max(input?.sessionLimit ?? 24, 1), 60);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const stephon = await resolveStephonNpc(db);
  if (!stephon) {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      worldId: STEPHON_WORLD_ID,
      worldLabel: "Site Builder",
      engineId: SITE_BUILDER_ENGINE_ID,
      npcConfigured: false,
      npcId: STEPHON_NPC_ID,
      npcName: null,
      totals: { sessions30d: 0, messages30d: 0, activeSessions: 0 },
      sessions: [],
      skipperBrief: `${STEPHON_DISPLAY_NAME} (${STEPHON_NPC_ID}) not found in OASIS — seed via Admin → NPC to capture Site Builder conversations for usability intelligence.`,
      usabilityThemes: [],
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
    .where(and(eq(oasisNpcSessions.npcId, stephon.id), gte(oasisNpcSessions.lastActivity, since)))
    .orderBy(desc(oasisNpcSessions.lastActivity))
    .limit(sessionLimit);

  const sessionRowIds = sessions.map((s) => s.id);
  const latestBySession = new Map<number, { content: string }>();

  if (sessionRowIds.length > 0) {
    const msgs = await db
      .select({
        sessionId: oasisNpcMessages.sessionId,
        content: oasisNpcMessages.content,
        createdAt: oasisNpcMessages.createdAt,
      })
      .from(oasisNpcMessages)
      .where(inArray(oasisNpcMessages.sessionId, sessionRowIds))
      .orderBy(desc(oasisNpcMessages.createdAt));

    for (const m of msgs) {
      if (!latestBySession.has(m.sessionId)) {
        latestBySession.set(m.sessionId, { content: m.content });
      }
    }
  }

  const [msgCountRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(oasisNpcMessages)
    .innerJoin(oasisNpcSessions, eq(oasisNpcMessages.sessionId, oasisNpcSessions.id))
    .where(and(eq(oasisNpcSessions.npcId, stephon.id), gte(oasisNpcMessages.createdAt, since)));

  const activeSessions = sessions.filter((s) => s.endedAt == null).length;

  const sessionRows = sessions.map((s) => {
    const last = latestBySession.get(s.id);
    const snippet = maskSnippet(last?.content ?? "");
    const usabilityHint = deriveUsabilityHint(snippet, s.currentTopic);
    return {
      sessionId: s.sessionId,
      sessionRowId: s.id,
      siteLabel: siteLabelFromTopic(s.currentTopic, s.sessionId),
      startedAt: new Date(s.startedAt as unknown as string).toISOString(),
      lastActivity: new Date(s.lastActivity as unknown as string).toISOString(),
      messageCount: s.messageCount,
      operatorLabel: operatorLabel(s.userId, s.sessionId),
      topic: s.currentTopic,
      lastSnippet: snippet,
      usabilityHint,
    };
  });

  const usabilityThemes = sessionRows
    .filter((s) => s.usabilityHint)
    .slice(0, 6)
    .map((s) => s.topic?.trim() || s.lastSnippet.slice(0, 72) || "Builder thread");

  const skipperBrief =
    sessions.length === 0
      ? `${stephon.name} is live on Site Builder — no operator sessions in the last 30 days yet.`
      : `${stephon.name}: ${sessions.length} builder session(s) (30d), ${Number(msgCountRow?.n ?? 0)} message(s). ${usabilityThemes.length} thread(s) flagged for usability review. Skipper can read masked snippets and propose engine improvements — no autonomous product changes.`;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    worldId: STEPHON_WORLD_ID,
    worldLabel: "Site Builder",
    engineId: SITE_BUILDER_ENGINE_ID,
    npcConfigured: true,
    npcId: stephon.npcId,
    npcName: stephon.name,
    totals: {
      sessions30d: sessions.length,
      messages30d: Number(msgCountRow?.n ?? 0),
      activeSessions,
    },
    sessions: sessionRows,
    skipperBrief,
    usabilityThemes,
    meta: {
      readOnly: true,
      piiMasked: true,
      skipperCanAccessTranscripts: true,
    },
  };
}
