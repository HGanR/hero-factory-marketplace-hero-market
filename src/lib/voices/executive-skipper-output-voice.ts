import { and, desc, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { aiAgents } from "@/lib/db/schema";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import { VOICE_PROVIDER_ELEVENLABS, VOICE_PROVIDER_OPENAI, VOICE_PROVIDER_SELF_HOSTED_TTS } from "@/lib/voices/voice-provider";

export type ExecutiveAgentOutputVoice = {
  voiceId: string;
  voiceProvider: string;
  agentId: string;
  agentName: string;
  /** Resolved from `ai_agents.agentRuntimeType` + name fallback (SKIPPER → executive_admin). */
  agentRuntimeType: string;
};

const SUPPORTED_OUTPUT = new Set([VOICE_PROVIDER_SELF_HOSTED_TTS, VOICE_PROVIDER_ELEVENLABS, VOICE_PROVIDER_OPENAI]);

/** Row shape for active SKIPPER-named agents (AI Agency). */
export type SkipperAgentCandidateRow = {
  id: string;
  name: string | null;
  agentRuntimeType: string | null;
  voiceId: string | null;
  voiceProvider: string | null;
  toolsJson: unknown;
  updatedAt: Date | null;
};

/**
 * Tie-breaker when multiple `ai_agents` rows match "SKIPPER" (name contains skipper, status active):
 * 1. Prefer `resolveAgentRuntimeType` === executive_admin (column or name-based SKIPPER).
 * 2. Then most recently updated (`updatedAt` DESC).
 * Draft/paused rows are excluded by SQL (`status = active`).
 */
export function rankSkipperAgentsForExecutivePreference(rows: SkipperAgentCandidateRow[]): SkipperAgentCandidateRow[] {
  return [...rows].sort((a, b) => {
    const ra = resolveAgentRuntimeType({ agentRuntimeType: a.agentRuntimeType, name: a.name });
    const rb = resolveAgentRuntimeType({ agentRuntimeType: b.agentRuntimeType, name: b.name });
    const pa = ra === "executive_admin" ? 1 : 0;
    const pb = rb === "executive_admin" ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
    const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
    return tb - ta;
  });
}

export async function listActiveSkipperAgentCandidates(
  db: MySql2Database<typeof schema>,
  userId: number,
  limit = 40,
): Promise<SkipperAgentCandidateRow[]> {
  return db
    .select({
      id: aiAgents.id,
      name: aiAgents.name,
      agentRuntimeType: aiAgents.agentRuntimeType,
      voiceId: aiAgents.voiceId,
      voiceProvider: aiAgents.voiceProvider,
      toolsJson: aiAgents.toolsJson,
      updatedAt: aiAgents.updatedAt,
    })
    .from(aiAgents)
    .where(and(eq(aiAgents.userId, userId), eq(aiAgents.status, "active"), sql`LOWER(${aiAgents.name}) LIKE '%skipper%'`))
    .orderBy(desc(aiAgents.updatedAt))
    .limit(limit);
}

/**
 * Active agent named SKIPPER for Executive read-aloud / output profile.
 * Uses executive_admin preference ordering, then first row with a supported output provider + voice id
 * (`elevenlabs`, `self_hosted_tts`, or OpenAI preset `openai` + voice id).
 */
export async function getSkipperOutputVoiceForUser(
  db: MySql2Database<typeof schema>,
  userId: number,
): Promise<ExecutiveAgentOutputVoice | null> {
  const rows = rankSkipperAgentsForExecutivePreference(await listActiveSkipperAgentCandidates(db, userId));
  for (const r of rows) {
    const vid = r.voiceId?.trim();
    const prov = r.voiceProvider?.trim().toLowerCase();
    if (!vid || !prov) continue;
    if (!SUPPORTED_OUTPUT.has(prov)) continue;
    const agentRuntimeType = resolveAgentRuntimeType({
      agentRuntimeType: r.agentRuntimeType,
      name: r.name,
    });
    return {
      agentId: r.id,
      agentName: r.name ?? "SKIPPER",
      voiceId: vid,
      voiceProvider: prov,
      agentRuntimeType,
    };
  }
  return null;
}

/**
 * Preferred SKIPPER row for diagnostics (identity), even when voice is not yet assigned.
 * Same ordering as {@link getSkipperOutputVoiceForUser}; returns first ranked row or null.
 */
export async function getPreferredSkipperAgentRowForUser(
  db: MySql2Database<typeof schema>,
  userId: number,
): Promise<SkipperAgentCandidateRow | null> {
  const rows = rankSkipperAgentsForExecutivePreference(await listActiveSkipperAgentCandidates(db, userId));
  return rows[0] ?? null;
}
