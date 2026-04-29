/**
 * Site-builder LLM boundary — keeps planner/regeneration off direct vendor SDKs.
 *
 * Add a provider by implementing `invoke` with the same OpenAI-style chat payload
 * used in `invokeLlmForAgent` (model + messages), then extend `selectSiteBuilderLlmInvoke`.
 */

import type { LlmMessage } from "@/lib/npc/llm";

/** Returns assistant text or null when the model yields nothing useful. */
export type SiteBuilderLlmInvoke = (messages: LlmMessage[]) => Promise<string | null>;

export type SiteBuilderLlmSource = "deterministic" | "managed" | "byok";

export type SiteBuilderLlmSelection = {
  invoke: SiteBuilderLlmInvoke | null;
  source: SiteBuilderLlmSource;
  /** When `llmMode === "off"`, blocks global OpenAI / NPC fallback in the planner. */
  forceDeterministic?: boolean;
};
