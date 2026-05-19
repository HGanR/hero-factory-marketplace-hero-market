import "server-only";

import {
  buildDeterministicExecutiveIntentPlan,
  mergeExecutiveIntentPlans,
  parseExecutiveIntentPlanFromLlmContent,
  type ExecutiveIntentPlan,
  type ExecutiveIntentPlannerReasoningMode,
} from "@/lib/executive-agent/executive-agent-intent-plan-pure";
import type { ExecutiveAgentScope } from "@/lib/executive-agent/executive-agent-policy";
import {
  buildExecutiveLlmUserMessage,
  createExecutiveLlmProvider,
  EXECUTIVE_AGENT_LLM_SYSTEM_PROMPT,
  isExecutiveLlmProviderConfigured,
} from "@/lib/executive-agent/executive-agent-llm";
import { redactSecretsFromExecutivePrompt } from "@/lib/executive-agent/executive-agent-prompt-redact";

/** Voice-only greeting / analytics clarification short-circuits run in `voice/turn` before this planner. */

export type { ExecutiveIntentPlan, ExecutiveIntentPlannerReasoningMode };

export type PlanExecutiveIntentInput = {
  prompt: string;
  requestedTool: string | null | undefined;
  dashboardMode: string | null | undefined;
  selectedAgents: string[] | null | undefined;
  selectedTimeRange: string | null | undefined;
  selectedClientId: string | null | undefined;
  selectedCampaignId: string | null | undefined;
  granted: Set<ExecutiveAgentScope>;
};

export type PlanExecutiveIntentResult = {
  plan: ExecutiveIntentPlan;
  reasoningMode: ExecutiveIntentPlannerReasoningMode;
};

/**
 * Builds a merged intent plan: deterministic baseline plus optional LLM layer when globally configured.
 * LLM failures or invalid JSON fall back to deterministic-only (reasoningMode llm_fallback).
 */
export async function planExecutiveIntent(input: PlanExecutiveIntentInput): Promise<PlanExecutiveIntentResult> {
  const deterministic = buildDeterministicExecutiveIntentPlan({
    prompt: input.prompt,
    requestedTool: input.requestedTool,
    dashboardMode: input.dashboardMode,
    selectedAgents: input.selectedAgents,
    selectedClientId: input.selectedClientId,
    granted: input.granted,
  });

  const provider = createExecutiveLlmProvider();
  if (!isExecutiveLlmProviderConfigured(provider)) {
    return { plan: deterministic, reasoningMode: "deterministic" };
  }

  const user = buildExecutiveLlmUserMessage({
    adminQuestionRedacted: redactSecretsFromExecutivePrompt(input.prompt),
    selectedAgents: input.selectedAgents ?? null,
    selectedTimeRange: input.selectedTimeRange ?? null,
    dashboardMode: input.dashboardMode ?? null,
    clientId: input.selectedClientId?.trim() || null,
    campaignId: input.selectedCampaignId?.trim() || null,
  });

  let text: string | null;
  try {
    text = await provider.completeJson({
      system: EXECUTIVE_AGENT_LLM_SYSTEM_PROMPT,
      user,
    });
  } catch {
    return {
      plan: deterministic,
      reasoningMode: "llm_fallback",
    };
  }

  const llmParsed = parseExecutiveIntentPlanFromLlmContent(text, input.granted);
  if (!llmParsed) {
    return {
      plan: deterministic,
      reasoningMode: "llm_fallback",
    };
  }

  return {
    plan: mergeExecutiveIntentPlans(deterministic, llmParsed),
    reasoningMode: "llm",
  };
}
