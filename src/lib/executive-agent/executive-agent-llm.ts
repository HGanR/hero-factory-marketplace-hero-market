import "server-only";

import { buildExecutiveIntentPlannerSystemPrompt } from "@/lib/agents/executive-admin-system-prompt";
import { invokeLlmForAgent, isGlobalManagedLlmConfigured } from "@/lib/npc/llm";

/**
 * System prompt for executive intent JSON — authoritative executive_admin stack + JSON planner rules (see executive-admin-system-prompt).
 */
export const EXECUTIVE_AGENT_LLM_SYSTEM_PROMPT = buildExecutiveIntentPlannerSystemPrompt();

export type ExecutiveLlmProviderId = "global_npc" | "none";

export type ExecutiveLlmProvider = {
  readonly id: ExecutiveLlmProviderId;
  completeJson(input: { system: string; user: string }): Promise<string | null>;
};

export function createExecutiveLlmProvider(): ExecutiveLlmProvider {
  if (!isGlobalManagedLlmConfigured()) {
    return {
      id: "none",
      async completeJson() {
        return null;
      },
    };
  }
  return {
    id: "global_npc",
    async completeJson({ system, user }) {
      return invokeLlmForAgent(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        null,
      );
    },
  };
}

export function isExecutiveLlmProviderConfigured(provider: ExecutiveLlmProvider): boolean {
  return provider.id !== "none";
}

export function buildExecutiveLlmUserMessage(input: {
  adminQuestionRedacted: string;
  selectedAgents: string[] | null;
  selectedTimeRange: string | null;
  dashboardMode: string | null;
  clientId: string | null;
  campaignId: string | null;
}): string {
  return JSON.stringify({
    adminQuestion: input.adminQuestionRedacted,
    selectedAgents: input.selectedAgents ?? [],
    selectedTimeRange: input.selectedTimeRange ?? null,
    dashboardMode: input.dashboardMode ?? null,
    clientId: input.clientId,
    campaignId: input.campaignId,
  });
}
