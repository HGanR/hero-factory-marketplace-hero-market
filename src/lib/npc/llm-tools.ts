import type { AgentLlmConfig } from "@/lib/npc/llm";

export class LlmChatCompletionError extends Error {
  constructor(
    message: string,
    public readonly kind: "http" | "tools_unsupported" | "empty",
    public readonly status?: number,
    public readonly raw?: unknown
  ) {
    super(message);
    this.name = "LlmChatCompletionError";
  }
}

export type OpenAiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

function resolveEndpoint(agentConfig?: AgentLlmConfig | null) {
  if (agentConfig?.llmEndpoint?.trim()) return agentConfig.llmEndpoint.trim();
  return process.env.NPC_LLM_ENDPOINT || "";
}

function resolveModel(agentConfig?: AgentLlmConfig | null) {
  if (agentConfig?.model?.trim()) return agentConfig.model.trim();
  return process.env.NPC_LLM_MODEL || "gpt-4o-mini";
}

async function resolveApiKey(agentConfig?: AgentLlmConfig | null): Promise<string | null> {
  if (agentConfig?.llmEndpoint?.trim() && agentConfig.llmApiKeyEnc?.trim()) {
    try {
      const { decryptToken } = await import("@/lib/social/encrypt");
      return decryptToken(agentConfig.llmApiKeyEnc.trim());
    } catch {
      return agentConfig.llmApiKeyEnc.trim();
    }
  }
  if (process.env.NPC_LLM_API_KEY) return process.env.NPC_LLM_API_KEY;
  return null;
}

export type ChatCompletionResult = {
  message: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
  } | null;
  finishReason: string | null;
  raw: unknown;
};

/**
 * Single OpenAI-compatible chat completion call (supports tools).
 */
export async function invokeOpenAiChatCompletion(
  messages: ChatMessage[],
  agentConfig: AgentLlmConfig | null,
  tools: OpenAiToolDefinition[]
): Promise<ChatCompletionResult> {
  const endpoint = resolveEndpoint(agentConfig);
  if (!endpoint) {
    return { message: null, finishReason: null, raw: null };
  }

  const model = resolveModel(agentConfig);
  const apiKey = await resolveApiKey(agentConfig);

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const payload: Record<string, unknown> = { model, messages };
  if (tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof (raw as { error?: { message?: string } })?.error?.message === "string"
      ? (raw as { error: { message: string } }).error.message
      : await res.text().catch(() => "");
    const ser = JSON.stringify(raw).toLowerCase();
    const likelyUnsupportedTools =
      res.status === 400 &&
      (ser.includes("tool") || ser.includes("function") || ser.includes("unknown") || ser.includes("invalid"));
    if (likelyUnsupportedTools) {
      throw new LlmChatCompletionError(
        `LLM may not support tools (${res.status}): ${msg}`,
        "tools_unsupported",
        res.status,
        raw
      );
    }
    throw new LlmChatCompletionError(`LLM request failed (${res.status}): ${msg}`, "http", res.status, raw);
  }

  const choice = (raw as { choices?: Array<{ message?: unknown; finish_reason?: string }> })?.choices?.[0];
  const msg = choice?.message as ChatCompletionResult["message"] | undefined;
  return {
    message: msg ?? null,
    finishReason: choice?.finish_reason ?? null,
    raw,
  };
}
