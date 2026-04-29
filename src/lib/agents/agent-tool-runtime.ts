import type { AgentLlmConfig, LlmMessage } from "@/lib/npc/llm";
import { invokeLlmForAgent } from "@/lib/npc/llm";
import {
  invokeOpenAiChatCompletion,
  type ChatMessage,
  LlmChatCompletionError,
} from "@/lib/npc/llm-tools";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import {
  buildLlmToolDefinitions,
  buildOpenAiToolDefinitionsFromDefs,
} from "@/lib/agent-plugins/tool-metadata";
import { executeAgentAction } from "@/lib/agent-plugins/execute-agent-action";
import { buildAuditDescriptor, logAgentToolCallAudit } from "@/lib/agent-plugins/audit-tool-call";
import { compactAgentActionForLlm } from "@/lib/agent-plugins/compact-tool-result";
import type { AgentChatTurn } from "@/lib/agent-plugins/write-confirmation-context";
import { normalizeAuditCategory } from "@/lib/agent-plugins/audit-codes";
import { GOOGLE_TOOLS_SYSTEM_ADDENDUM } from "@/lib/agent-plugins/google-tool-guidance";
import { normalizeConversationHistory } from "@/lib/agent-plugins/conversation-normalize";
import {
  persistAgentConversationAfterReply,
  resolveMergedPriorForLlm,
} from "@/lib/agent-plugins/agent-session-memory";

const MAX_TOOL_ROUNDS = 6;

const MAX_DEDUPE_KEYS = 48;

function stableToolFingerprint(actionKey: string, args: unknown): string {
  const o = args && typeof args === "object" ? { ...(args as Record<string, unknown>) } : {};
  delete o.confirmed;
  const keys = Object.keys(o).sort();
  const norm: Record<string, unknown> = {};
  for (const k of keys) norm[k] = o[k];
  return `${actionKey}:${JSON.stringify(norm)}`;
}

function hasLlmEndpoint(agentConfig: AgentLlmConfig | null): boolean {
  if (agentConfig?.llmEndpoint?.trim()) return true;
  return Boolean(process.env.NPC_LLM_ENDPOINT?.trim());
}

export type AgentLlmTelemetryFallbackReason =
  | "llm_tools_unsupported"
  | "tool_loop_error"
  /** No Custom API / NPC_LLM_ENDPOINT — tool loop cannot run */
  | "no_llm_endpoint_configured"
  /** OAuth/scopes/plugins yield zero executable Google tools */
  | "no_executable_google_tools"
  /** First chat completion returned no assistant message (upstream empty/null) */
  | "llm_first_response_null"
  | "empty_model_reply"
  /** Public / site-builder embed: tool loop intentionally skipped */
  | "skip_tools_public_widget";

/** Plain mode may omit fallbackReason when tools were never attempted. */
export type AgentLlmTelemetry =
  | { mode: "tools" }
  | { mode: "plain"; fallbackReason?: AgentLlmTelemetryFallbackReason };

export type AgentLlmTelemetryLogContext = {
  source: string;
  widgetKey?: string;
};

function logAgentLlmTelemetry(params: {
  agentId: string;
  telemetry: AgentLlmTelemetry;
  context?: AgentLlmTelemetryLogContext;
  invokedPlainLlm?: boolean;
}): void {
  const line: Record<string, unknown> = {
    tag: "agent_llm_telemetry",
    agentId: params.agentId,
    source: params.context?.source ?? "unspecified",
    mode: params.telemetry.mode,
  };
  if (params.context?.widgetKey) line.widgetKey = params.context.widgetKey;
  if (params.invokedPlainLlm !== undefined) line.invokedPlainLlm = params.invokedPlainLlm;
  if (params.telemetry.mode === "plain") {
    line.plainMode = true;
    if (params.telemetry.fallbackReason) line.fallbackReason = params.telemetry.fallbackReason;
    else line.fallbackReason = "unspecified_plain";
  } else {
    line.plainMode = false;
  }
  console.log(JSON.stringify(line));
}

/** Completed = tool loop ran and produced assistant text (may be empty). Aborted = skip tool loop with reason. */
export type GoogleToolLoopOutcome =
  | { outcome: "completed"; text: string }
  | { outcome: "aborted"; reason: AgentLlmTelemetryFallbackReason };

/**
 * If Google tools are executable and an LLM endpoint exists, runs a tool loop.
 * Otherwise returns aborted with a specific reason (distinguishable in logs).
 */
export async function tryRunAgentChatWithGoogleTools(params: {
  userId: number;
  agentId: string;
  systemPrompt: string;
  userMessage: string;
  agentLlmConfig: AgentLlmConfig | null;
  /** Prior turns (excludes the current user message). Enables multi-turn confirmation. */
  priorMessages?: AgentChatTurn[];
  /** Merges with server session inside executeAgentAction when set. */
  chatSessionId?: string | null;
}): Promise<GoogleToolLoopOutcome> {
  const { userId, agentId, systemPrompt, userMessage, agentLlmConfig, priorMessages = [], chatSessionId } =
    params;

  if (!hasLlmEndpoint(agentLlmConfig)) {
    return { outcome: "aborted", reason: "no_llm_endpoint_configured" };
  }

  const resolved = await resolveAgentCapabilities(agentId);
  if (resolved.executableActions.length === 0) {
    return { outcome: "aborted", reason: "no_executable_google_tools" };
  }

  const defs = buildLlmToolDefinitions(resolved);
  const tools = buildOpenAiToolDefinitionsFromDefs(defs);
  const nameToAction = new Map(defs.map((d) => [d.name, d.actionKey] as const));

  let messages: ChatMessage[] = [
    { role: "system", content: `${systemPrompt}\n\n${GOOGLE_TOOLS_SYSTEM_ADDENDUM}` },
    ...priorMessages.map((p) => ({ role: p.role, content: p.content } as ChatMessage)),
    { role: "user", content: userMessage },
  ];

  const dedupeKeys = new Set<string>();
  const assistantTextSlices: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { message } = await invokeOpenAiChatCompletion(messages, agentLlmConfig, tools);
    if (!message) {
      return { outcome: "aborted", reason: "llm_first_response_null" };
    }

    if (typeof message.content === "string" && message.content.trim()) {
      assistantTextSlices.push(message.content);
    }

    const toolCalls = message.tool_calls;
    if (!toolCalls?.length) {
      const text = typeof message.content === "string" ? message.content : "";
      return { outcome: "completed", text };
    }

    messages.push({
      role: "assistant",
      content: message.content,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      const fnName = tc.function?.name ?? "";
      const actionKey = nameToAction.get(fnName);

      let toolPayload: Record<string, unknown>;
      if (!actionKey) {
        toolPayload = { ok: false, error: "Unknown tool", code: "UNKNOWN_TOOL" };
        await logAgentToolCallAudit({
          agentId,
          userId,
          actionKey: fnName || "unknown",
          input: { name: fnName },
          success: false,
          errorCode: normalizeAuditCategory("UNKNOWN_TOOL"),
          successDescriptor: "err|UNKNOWN_TOOL",
          latencyMs: null,
        });
      } else {
        let args: unknown = {};
        try {
          const raw = tc.function?.arguments?.trim();
          args = raw ? JSON.parse(raw) : {};
        } catch {
          args = {};
        }

        const fp = stableToolFingerprint(actionKey, args);
        if (dedupeKeys.has(fp)) {
          toolPayload = {
            ok: false,
            error: "This exact tool call was already executed in this turn. Use the previous result.",
            code: "DUPLICATE_TOOL_CALL",
          };
          await logAgentToolCallAudit({
            agentId,
            userId,
            actionKey,
            input: args,
            success: false,
            errorCode: normalizeAuditCategory("DUPLICATE_TOOL_CALL"),
            successDescriptor: "err|DUPLICATE_TOOL_CALL",
            latencyMs: 0,
          });
        } else {
          if (dedupeKeys.size < MAX_DEDUPE_KEYS) dedupeKeys.add(fp);

          const t0 = Date.now();
          const out = await executeAgentAction({
            userId,
            agentId,
            actionKey,
            input: args,
            conversation: {
              priorMessages,
              userMessage,
              currentLoopAssistantTurns: [...assistantTextSlices],
            },
            sessionId: chatSessionId,
          });
          const latencyMs = Date.now() - t0;
          const draftIdHint =
            !out.ok && actionKey === "gmail.sendDraft" && args && typeof args === "object"
              ? String((args as Record<string, unknown>).draftId ?? "").trim() || null
              : null;
          await logAgentToolCallAudit({
            agentId,
            userId,
            actionKey,
            input: args,
            success: out.ok,
            errorCode: normalizeAuditCategory(out.ok ? null : out.code),
            successDescriptor: buildAuditDescriptor({
              actionKey,
              ok: out.ok,
              code: out.ok ? undefined : out.code,
              result: out.ok ? out.result : undefined,
              inputDraftIdHint: draftIdHint,
            }),
            latencyMs,
          });

          if (out.ok) {
            toolPayload = { ok: true, result: compactAgentActionForLlm(out.result) };
          } else {
            toolPayload = { ok: false, error: out.error, code: out.code };
          }
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolPayload),
      });
    }
  }

  const { message: finalMsg } = await invokeOpenAiChatCompletion(messages, agentLlmConfig, []);
  const finalText = typeof finalMsg?.content === "string" ? finalMsg.content : "";
  return { outcome: "completed", text: finalText };
}

/**
 * Agent reply: Google tool loop when tools + endpoint exist; otherwise plain LLM.
 */
export async function runAgentLlmReply(params: {
  userId: number;
  agentId: string;
  systemPrompt: string;
  userMessage: string;
  agentLlmConfig: AgentLlmConfig | null;
  priorMessages?: AgentChatTurn[];
  /** When set, merges prior turns with server history and persists after reply. */
  chatSessionId?: string | null;
  /** When set, logs structured telemetry (e.g. widgetKey for embed diagnostics). */
  telemetryLogContext?: AgentLlmTelemetryLogContext;
  /**
   * Public widget / embed safety: when true, never runs the Google tool loop (chat + optional knowledge only).
   */
  skipAgentTools?: boolean;
  /**
   * When set, used for the plain chat completion path instead of `invokeLlmForAgent(..., agentLlmConfig)`.
   * Enables site-builder BYOK / managed selection for widget traffic without duplicating session logic.
   */
  overridePlainLlmInvoke?: (messages: LlmMessage[]) => Promise<string | null>;
}): Promise<{ reply: string | null; telemetry: AgentLlmTelemetry }> {
  let telemetry: AgentLlmTelemetry = { mode: "plain" };

  const normalizedClient = normalizeConversationHistory(params.priorMessages ?? []);
  const mergedPrior = await resolveMergedPriorForLlm({
    userId: params.userId,
    agentId: params.agentId,
    chatSessionId: params.chatSessionId,
    clientPrior: normalizedClient,
  });

  const mergedParams = { ...params, priorMessages: mergedPrior };

  let reply: string | null = null;

  let invokedPlainLlm = false;

  if (!params.skipAgentTools) {
    try {
      const toolOutcome = await tryRunAgentChatWithGoogleTools(mergedParams);
      if (toolOutcome.outcome === "completed") {
        reply = toolOutcome.text;
        telemetry = { mode: "tools" };
      } else {
        telemetry = { mode: "plain", fallbackReason: toolOutcome.reason };
      }
    } catch (e) {
      if (e instanceof LlmChatCompletionError && e.kind === "tools_unsupported") {
        console.warn("[agent] LLM endpoint rejected tool calling; using plain chat.", e.message);
        telemetry = { mode: "plain", fallbackReason: "llm_tools_unsupported" };
      } else {
        console.warn("[agent] Google tool loop failed; using plain LLM.", e);
        telemetry = { mode: "plain", fallbackReason: "tool_loop_error" };
      }
    }
  } else {
    telemetry = { mode: "plain", fallbackReason: "skip_tools_public_widget" };
  }

  if (reply === null) {
    const flat: LlmMessage[] = [
      { role: "system", content: params.systemPrompt },
      ...mergedPrior.map((p) => ({ role: p.role, content: p.content })),
      { role: "user", content: params.userMessage },
    ];

    invokedPlainLlm = true;
    if (params.overridePlainLlmInvoke) {
      reply = await params.overridePlainLlmInvoke(flat);
    } else {
      reply = await invokeLlmForAgent(flat, params.agentLlmConfig);
    }
  }

  logAgentLlmTelemetry({
    agentId: params.agentId,
    telemetry,
    context: params.telemetryLogContext,
    invokedPlainLlm,
  });

  if (params.chatSessionId?.trim()) {
    await persistAgentConversationAfterReply({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.chatSessionId,
      mergedPrior,
      userMessage: params.userMessage,
      assistantReply: reply,
    });
  }

  return { reply, telemetry };
}
