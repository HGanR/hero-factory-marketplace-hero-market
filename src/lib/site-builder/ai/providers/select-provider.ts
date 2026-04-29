import {
  invokeLlmForAgent,
  invokeNpcLlm,
  isGlobalManagedLlmConfigured,
  type AgentLlmConfig,
  type LlmMessage,
} from "@/lib/npc/llm";
import type { SiteBuilderLlmSelection, SiteBuilderLlmSource } from "@/lib/site-builder/ai/providers/types";

/** Normalized row from `web3_site_builder_ai_settings` (null = no row). */
export type SiteBuilderAiSettingsInput = {
  llmMode: "off" | "platform" | "byok";
  endpoint: string | null;
  model: string | null;
  apiKeyEnc: string | null;
  fallbackToPlatform: boolean;
} | null;

function managedAvailable(): boolean {
  return isGlobalManagedLlmConfigured();
}

function byokMisconfigured(s: SiteBuilderAiSettingsInput): boolean {
  if (!s || s.llmMode !== "byok") return false;
  return !s.endpoint?.trim() || !s.apiKeyEnc?.trim();
}

function throwByokConfigError(): never {
  throw new Error(
    "[site-builder BYOK] Missing endpoint or encrypted API key. Fix site AI settings or enable fallback to platform.",
  );
}

/**
 * Select LLM invoker for site-builder planner/regeneration.
 *
 * - No row: same as historical behavior — managed when `NPC_LLM_ENDPOINT` or `OPENAI_API_KEY` (default OpenAI URL) is set, else deterministic.
 * - `off`: deterministic only (invoke null).
 * - `platform`: managed when env configured, else deterministic.
 * - `byok`: `invokeLlmForAgent` with stored endpoint/key; misconfiguration throws unless fallback allowed.
 */
export function selectSiteBuilderLlmInvoke(settings: SiteBuilderAiSettingsInput): SiteBuilderLlmSelection {
  if (!settings) {
    if (managedAvailable()) {
      return { invoke: invokeNpcLlm, source: "managed" };
    }
    return { invoke: null, source: "deterministic" };
  }

  if (settings.llmMode === "off") {
    return { invoke: null, source: "deterministic", forceDeterministic: true };
  }

  if (settings.llmMode === "platform") {
    if (managedAvailable()) {
      return { invoke: invokeNpcLlm, source: "managed" };
    }
    return { invoke: null, source: "deterministic" };
  }

  if (settings.llmMode === "byok") {
    if (byokMisconfigured(settings)) {
      if (settings.fallbackToPlatform && managedAvailable()) {
        return { invoke: invokeNpcLlm, source: "managed" };
      }
      return {
        invoke: async (_messages: LlmMessage[]) => {
          throwByokConfigError();
        },
        source: "byok",
      };
    }
    const config: AgentLlmConfig = {
      llmEndpoint: settings.endpoint!.trim(),
      model: settings.model?.trim() || null,
      llmApiKeyEnc: settings.apiKeyEnc!.trim(),
    };
    const invoke: SiteBuilderLlmSelection["invoke"] = (messages) => invokeLlmForAgent(messages, config);
    return { invoke, source: "byok" };
  }

  return { invoke: null, source: "deterministic" };
}

export function siteBuilderLlmSourceLabel(source: SiteBuilderLlmSource): string {
  return source;
}
