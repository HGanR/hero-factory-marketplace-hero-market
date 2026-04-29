import { buildNpcResponse } from "@/lib/npc/engine";
import { generateLlmResponse } from "@/lib/npc/llm-bridge";
import { getNpcByNpcId, getNpcRowByNpcId, getKnowledgeForNpc } from "@/lib/npc/db";

export type RunNpcChatResult = {
  reply: string;
  mood?: string;
  source?: string;
  intent?: string;
};

/**
 * Run NPC chat server-side (no HTTP, no session). Used by workflow runner
 * when an NPC node is executed in a flow.
 * @param npcId - platform NPC id (e.g. trust-advisor, oasis-secretary)
 * @param message - user message
 * @param context - optional workspace/trust context for Jarva
 */
export async function runNpcChat(
  npcId: string,
  message: string,
  context?: { trustId?: string; workspaceId?: string; clientId?: string; currentStep?: string; completionPct?: number; blockers?: string[]; advisories?: string[] }
): Promise<RunNpcChatResult> {
  const profile = await getNpcByNpcId(npcId);
  const npcRow = await getNpcRowByNpcId(npcId);
  if (!profile || !npcRow) {
    throw new Error(`NPC not found: ${npcId}`);
  }

  const knowledge = await getKnowledgeForNpc(npcRow.id);
  const npcContext = context
    ? {
        source: "oasis-world" as const,
        trustId: context.trustId,
        workspaceId: context.workspaceId,
        clientId: context.clientId,
        currentStep: context.currentStep,
        completionPct: context.completionPct,
        blockers: context.blockers,
        advisories: context.advisories,
      }
    : undefined;

  let response = buildNpcResponse({ message, profile, knowledge, context: npcContext });

  if (response.source === "rule" && response.intent === "unknown") {
    try {
      const llmResponse = await generateLlmResponse({
        message,
        profile,
        knowledge,
        context: npcContext,
      });
      if (llmResponse?.text) {
        response = {
          ...llmResponse,
          suggestions: llmResponse.suggestions?.length ? llmResponse.suggestions : response.suggestions,
        };
      }
    } catch {
      // Keep rule-based response
    }
  }

  return {
    reply: response.text,
    mood: response.mood,
    source: response.source,
    intent: response.intent,
  };
}
