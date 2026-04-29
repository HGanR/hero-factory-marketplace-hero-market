import type { AgentChatTurn, AgentConversationContext } from "@/lib/agent-plugins/write-confirmation-context";

const MAX_TURN_CHARS = 200_000;
const MAX_LOOP_ASSISTANT_SLICES = 24;
const MAX_LOOP_SLICE_CHARS = 500_000;

/**
 * Single canonical shape for chat turns before confirmation validation or session merge.
 * Call from every entry point (widget, builder test, capabilities execute, tool runtime).
 */
export function normalizeConversationHistory(raw: unknown): AgentChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    out.push({ role, content: content.slice(0, MAX_TURN_CHARS) });
  }
  return out;
}

export function normalizeAgentConversationContext(input: unknown): AgentConversationContext {
  if (input == null || typeof input !== "object") {
    return { priorMessages: [], userMessage: "" };
  }
  const o = input as Record<string, unknown>;
  const priorMessages = normalizeConversationHistory(o.priorMessages);
  const userMessage = typeof o.userMessage === "string" ? o.userMessage.slice(0, MAX_TURN_CHARS) : "";
  const currentLoopAssistantTurns = Array.isArray(o.currentLoopAssistantTurns)
    ? o.currentLoopAssistantTurns
        .filter((t): t is string => typeof t === "string")
        .slice(0, MAX_LOOP_ASSISTANT_SLICES)
        .map((t) => t.slice(0, MAX_LOOP_SLICE_CHARS))
    : undefined;
  return { priorMessages, userMessage, currentLoopAssistantTurns };
}
