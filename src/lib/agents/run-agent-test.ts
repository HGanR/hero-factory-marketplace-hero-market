import { asc, eq } from "drizzle-orm";
import {
  answerFromKnowledgeOnly,
  buildKnowledgeContextFromRows,
  buildKnowledgeContextFromRowsWithDebug,
} from "@/lib/agents/retrieval";
import { getDb } from "@/lib/db";
import { runAgentLlmReply, type AgentLlmTelemetry } from "@/lib/agents/agent-tool-runtime";
import { aiAgents, aiAgentKnowledgeItems } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { normalizeConversationHistory } from "@/lib/agent-plugins/conversation-normalize";
import type { AgentChatTurn } from "@/lib/agent-plugins/write-confirmation-context";
import { resolveUnifiedAgentRuntimeContext } from "@/lib/agents/unified-skipper-runtime-context";
import { resolveUnifiedSkipperRuntimeContext } from "@/lib/agents/skipper-unified-runtime";

export type RunAgentTestResult = {
  reply: string;
  debug?: { selectedChunks: { id: string; score: number; preview: string }[] };
  /** How the reply was produced (tools vs plain LLM) and why fallback happened. */
  telemetry?: AgentLlmTelemetry;
};

/**
 * Run agent test (chat) server-side. Used by both the HTTP test endpoint and the workflow runner.
 * @param priorMessages — prior user/assistant turns (excludes the current `message`); required for reliable write-tool confirmation in chat.
 */
export async function runAgentTest(
  userId: number,
  agentId: string,
  message: string,
  debugRetrieval = false,
  priorMessages: AgentChatTurn[] = [],
  chatSessionId?: string | null
): Promise<RunAgentTestResult> {
  const db = await getDb();

  const canAccess = await canAccessAgent(agentId, userId);
  if (!canAccess) throw new Error("Agent not found");

  const rows = await db
    .select({
      llmEndpoint: aiAgents.llmEndpoint,
      llmApiKeyEnc: aiAgents.llmApiKeyEnc,
      model: aiAgents.model,
    })
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error("Agent not found");

  const agentLlmConfig = row.llmEndpoint?.trim()
    ? { llmEndpoint: row.llmEndpoint, llmApiKeyEnc: row.llmApiKeyEnc, model: row.model }
    : null;

  const knowledgeRows = await db
    .select({
      id: aiAgentKnowledgeItems.id,
      contentOrPointer: aiAgentKnowledgeItems.contentOrPointer,
      type: aiAgentKnowledgeItems.type,
    })
    .from(aiAgentKnowledgeItems)
    .where(eq(aiAgentKnowledgeItems.agentId, agentId))
    .orderBy(asc(aiAgentKnowledgeItems.sortOrder));

  let knowledgeContext: string;
  let debugChunks: { id: string; score: number; preview: string }[] | undefined;

  if (debugRetrieval) {
    const { context, selectedChunks } = buildKnowledgeContextFromRowsWithDebug(
      knowledgeRows,
      message,
      8
    );
    knowledgeContext = context;
    debugChunks = selectedChunks;
  } else {
    knowledgeContext = buildKnowledgeContextFromRows(knowledgeRows, message, 8);
  }

  const cognitive = await resolveUnifiedSkipperRuntimeContext({
    surface: "ai_agency_test",
    db,
    userId,
    agentId,
    knowledgeUserMessage: message,
  });
  const base =
    cognitive ??
    (await resolveUnifiedAgentRuntimeContext(db, {
      entryPoint: "ai_agency_test_chat",
      userId,
      agentId,
      knowledgeUserMessage: message,
    }));
  const systemPrompt = base.systemPrompt;

  const normalizedPrior = normalizeConversationHistory(Array.isArray(priorMessages) ? priorMessages : []);

  const { reply: llmReply, telemetry } = await runAgentLlmReply({
    userId,
    agentId,
    systemPrompt,
    userMessage: message,
    agentLlmConfig,
    priorMessages: normalizedPrior,
    chatSessionId,
    telemetryLogContext: { source: "agent_builder_test" },
  });

  let text: string;
  if (llmReply) {
    text = llmReply;
  } else {
    const knowledgeAnswer = answerFromKnowledgeOnly(knowledgeRows, message, 3);
    if (knowledgeAnswer) {
      text =
        knowledgeAnswer +
        "\n\n_(Answers from your knowledge base. Add a Custom API in agent settings or set NPC_LLM_ENDPOINT for synthesized responses.)_";
    } else {
      text =
        "LLM not configured. Add a Custom API in agent settings (Endpoint + API key), or set NPC_LLM_ENDPOINT globally. Add knowledge PDFs to answer from your documents without an LLM.";
    }
  }

  const result: RunAgentTestResult = { reply: text, telemetry };
  if (debugRetrieval && debugChunks) {
    result.debug = { selectedChunks: debugChunks };
  }
  return result;
}
