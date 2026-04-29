export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type AgentLlmConfig = {
  llmEndpoint?: string | null;
  llmApiKeyEnc?: string | null;
  model?: string | null;
};

export const DEFAULT_OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI or compatible global chat: `NPC_LLM_*` and/or `OPENAI_API_KEY` (default URL when only key is set).
 * Used by site builder planner, agents, and provider `managed` / legacy paths.
 */
export function isGlobalManagedLlmConfigured(): boolean {
  return Boolean(process.env.NPC_LLM_ENDPOINT?.trim() || process.env.OPENAI_API_KEY?.trim());
}

/** Model id sent to the chat Completions API (read by responses / UI meta). */
export function getResolvedGlobalLlmModel(): string {
  return (
    process.env.NPC_LLM_MODEL?.trim() ||
    process.env.OPENAI_DEFAULT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function resolveGlobalChatEndpointForInvoke(): { endpoint: string; apiKey: string | null } {
  const n = process.env.NPC_LLM_ENDPOINT?.trim();
  if (n) {
    return { endpoint: n, apiKey: process.env.NPC_LLM_API_KEY?.trim() || null };
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { endpoint: DEFAULT_OPENAI_CHAT_COMPLETIONS_URL, apiKey: process.env.OPENAI_API_KEY.trim() };
  }
  return { endpoint: "", apiKey: null };
}

function resolveModel() {
  return getResolvedGlobalLlmModel();
}

/**
 * Invoke LLM with optional per-agent overrides. If agentConfig has llmEndpoint, use it;
 * otherwise use global NPC_LLM_ENDPOINT. Decrypts agent llmApiKeyEnc when SOCIAL_ENCRYPTION_KEY is set.
 */
export async function invokeLlmForAgent(
  messages: LlmMessage[],
  agentConfig?: AgentLlmConfig | null
): Promise<string | null> {
  let endpoint = "";
  let apiKey: string | null = null;
  let model = resolveModel();

  if (agentConfig?.llmEndpoint?.trim()) {
    endpoint = agentConfig.llmEndpoint.trim();
    if (agentConfig.model?.trim()) model = agentConfig.model.trim();
    if (agentConfig.llmApiKeyEnc?.trim()) {
      try {
        const { decryptToken } = await import("@/lib/social/encrypt");
        apiKey = decryptToken(agentConfig.llmApiKeyEnc.trim());
      } catch {
        apiKey = agentConfig.llmApiKeyEnc.trim(); // dev fallback if not encrypted
      }
    }
  } else {
    const g = resolveGlobalChatEndpointForInvoke();
    endpoint = g.endpoint;
    apiKey = g.apiKey;
  }

  if (!endpoint) return null;

  try {
    const host = new URL(endpoint).host;
    const systemContent = messages.find((m) => m.role === "system")?.content ?? "";
    const contextPreview = systemContent.slice(0, 200);
    console.log("[LLM] endpoint host:", host, "| context preview (200 chars):", contextPreview || "(none)");
  } catch {
    /* ignore parse errors */
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const payload = { model, messages };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${msg}`);
  }

  const data = await res.json().catch(() => ({}));
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.response ??
    data?.text ??
    null;
  return typeof content === "string" ? content : null;
}

/** @deprecated Use invokeLlmForAgent(messages) for global config. */
export async function invokeNpcLlm(messages: LlmMessage[]): Promise<string | null> {
  return invokeLlmForAgent(messages, null);
}
