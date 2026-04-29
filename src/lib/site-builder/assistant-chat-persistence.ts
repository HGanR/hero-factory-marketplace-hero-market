/**
 * Site Builder assistant chat: session persistence rules and deduplication.
 *
 * Long-term learning is **not** stored here — it lives in `site_generation_runs`,
 * `site_generation_variants`, `site_variant_feedback`, publish/rollup tables, etc.
 * (see `lib/site-builder/intelligence/repository.ts` and pipeline responses with `intelligenceRunId`).
 */

export type AssistantChatRole = "user" | "assistant" | "status" | "error" | "debug";

export type AssistantChatMessage = {
  id: string;
  role: AssistantChatRole;
  content: string;
  at: number;
};

/** Canonical success copy for a completed full build (variant pick or direct preview). */
export const CHAT_FULL_BUILD_SUCCESS = "Your site is ready. Choose a layout or keep editing.";

export function normalizeChatContent(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

/**
 * Assistant lines that are legacy/generic pipeline echoes — do not persist or re-hydrate.
 */
export function isNonPersistableAssistantEcho(content: string): boolean {
  const t = normalizeChatContent(content).toLowerCase();
  if (!t) return true;
  if (t.startsWith("your site is in the preview")) return true;
  if (t.startsWith("first draft is in the preview")) return true;
  if (t === "your site is ready. keep editing with natural language below.") return true;
  // Generic pipeline failure lines without API detail (apostrophe may be ASCII or Unicode)
  if (/^the build didn.t finish/i.test(t) && !/:\s*\S/.test(t)) return true;
  if (/^full rebuild didn.t complete/i.test(t) && !/:\s*\S/.test(t)) return true;
  return false;
}

export function shouldPersistChatMessage(m: Pick<AssistantChatMessage, "role" | "content">): boolean {
  if (m.role === "user") return true;
  if (m.role === "error" || m.role === "status" || m.role === "debug") return false;
  if (m.role !== "assistant") return false;
  return !isNonPersistableAssistantEcho(m.content);
}

/** Collapse repeated “same kind” assistant pipeline success echoes (not failures — those can differ by API detail). */
export function assistantSemanticBucket(content: string): string | null {
  const t = normalizeChatContent(content).toLowerCase();
  if (t.includes("matched your current preview") || t.includes("preview already matched")) {
    return "preview_unchanged_family";
  }
  if (
    t.includes("your site is ready") ||
    t.includes("your site is in the preview") ||
    t.includes("first draft is in the preview") ||
    t.includes("a few layout options are ready") ||
    t.includes("layout options are ready")
  ) {
    return "build_success_family";
  }
  return null;
}

export function shouldSkipConsecutiveChatMessage(
  prev: AssistantChatMessage[],
  role: AssistantChatRole,
  content: string,
): boolean {
  const t = normalizeChatContent(content);
  if (!t) return true;
  const last = prev[prev.length - 1];
  if (!last) return false;
  if (last.role === role && normalizeChatContent(last.content) === t) return true;
  if (role === "assistant" && last.role === "assistant") {
    const bNew = assistantSemanticBucket(t);
    const bLast = assistantSemanticBucket(last.content);
    if (bNew && bLast && bNew === bLast) return true;
  }
  if (role === "error" && last.role === "error" && normalizeChatContent(last.content) === t) return true;
  return false;
}

export function filterChatMessagesForStorage(messages: AssistantChatMessage[]): AssistantChatMessage[] {
  const out: AssistantChatMessage[] = [];
  for (const m of messages) {
    if (!shouldPersistChatMessage(m)) continue;
    if (shouldSkipConsecutiveChatMessage(out, m.role, m.content)) continue;
    out.push(m);
  }
  return out;
}
