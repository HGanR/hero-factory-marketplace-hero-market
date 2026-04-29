import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentConversationSessions } from "@/lib/db/schema";
import type { AgentChatTurn, AgentConversationContext } from "@/lib/agent-plugins/write-confirmation-context";

const MAX_STORED_TURNS = 80;

export function buildAgentChatSessionKey(userId: number, agentId: string, sessionId: string): string {
  const sid = sessionId.trim();
  const raw = `${userId}:${agentId}:${sid || "default"}`;
  if (raw.length <= 128) return raw;
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Prefer the longer branch so a degraded client cannot truncate a fuller server transcript (and vice versa when the client is ahead).
 */
export function mergePriorMessages(stored: AgentChatTurn[], client: AgentChatTurn[]): AgentChatTurn[] {
  if (client.length === 0) return stored;
  if (stored.length === 0) return client;
  return client.length >= stored.length ? client : stored;
}

export async function loadAgentConversationTurns(
  userId: number,
  agentId: string,
  sessionId: string
): Promise<AgentChatTurn[]> {
  const key = buildAgentChatSessionKey(userId, agentId, sessionId);
  try {
    await ensureAgentTables();
    const db = await getDb();
    const rows = await db
      .select({ turnsJson: agentConversationSessions.turnsJson })
      .from(agentConversationSessions)
      .where(
        and(
          eq(agentConversationSessions.sessionKey, key),
          eq(agentConversationSessions.agentId, agentId),
          eq(agentConversationSessions.userId, userId)
        )
      )
      .limit(1);
    const raw = rows[0]?.turnsJson;
    if (!raw || typeof raw !== "string") return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AgentChatTurn[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const role = (item as { role?: string }).role;
      const content = (item as { content?: string }).content;
      if ((role === "user" || role === "assistant") && typeof content === "string") {
        out.push({ role, content });
      }
    }
    return out;
  } catch (e) {
    console.error("[agent-conversation-sessions] load failed", e);
    return [];
  }
}

export async function persistAgentConversationAfterReply(params: {
  userId: number;
  agentId: string;
  sessionId: string;
  mergedPrior: AgentChatTurn[];
  userMessage: string;
  assistantReply: string | null;
}): Promise<void> {
  const { userId, agentId, sessionId, mergedPrior, userMessage, assistantReply } = params;
  const key = buildAgentChatSessionKey(userId, agentId, sessionId);
  const turns: AgentChatTurn[] = [...mergedPrior, { role: "user", content: userMessage }];
  if (assistantReply && assistantReply.trim()) {
    turns.push({ role: "assistant", content: assistantReply });
  }
  const trimmed = turns.length > MAX_STORED_TURNS ? turns.slice(-MAX_STORED_TURNS) : turns;
  try {
    await ensureAgentTables();
    const db = await getDb();
    await db
      .insert(agentConversationSessions)
      .values({
        sessionKey: key,
        agentId,
        userId,
        turnsJson: JSON.stringify(trimmed),
      })
      .onDuplicateKeyUpdate({
        set: {
          turnsJson: JSON.stringify(trimmed),
          updatedAt: new Date(),
        },
      });
  } catch (e) {
    console.error("[agent-conversation-sessions] persist failed", e);
  }
}

export async function resolveMergedPriorForLlm(params: {
  userId: number;
  agentId: string;
  chatSessionId: string | null | undefined;
  clientPrior: AgentChatTurn[];
}): Promise<AgentChatTurn[]> {
  const { userId, agentId, chatSessionId, clientPrior } = params;
  if (!chatSessionId?.trim()) return clientPrior;
  const stored = await loadAgentConversationTurns(userId, agentId, chatSessionId);
  return mergePriorMessages(stored, clientPrior);
}

/** Merges stored turns with client prior for execute / write gates (same rules as LLM path). */
export async function resolveMergedConversationForExecute(params: {
  userId: number;
  agentId: string;
  sessionId: string | null | undefined;
  client: AgentConversationContext;
}): Promise<AgentConversationContext> {
  const { userId, agentId, sessionId, client } = params;
  if (!sessionId?.trim()) return client;
  const stored = await loadAgentConversationTurns(userId, agentId, sessionId);
  return {
    ...client,
    priorMessages: mergePriorMessages(stored, client.priorMessages),
  };
}
