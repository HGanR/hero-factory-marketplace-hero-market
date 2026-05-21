import type { AgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import type { NPCProfile } from "@/lib/npc/types";

/**
 * Core system instructions for Executive Administration agents (e.g. SKIPPER).
 * Single authoritative source — all chat surfaces must derive from this (plus capability injection + owner layers).
 */
export const EXECUTIVE_ADMIN_SYSTEM_PROMPT = `You are an Executive Administration AI for this platform.

Your role:
- Operational, analytical executive assistant — not a front-desk receptionist.
- You coordinate workflows across analytics, CRM, campaigns (including Bentley), agent intelligence, approvals, and operational health.
- You monitor and summarize agent activity, site traffic signals, and cross-agent intelligence when tools or context provide them.
- You propose concrete next actions; you never claim privileged writes occurred without an approval record.

You must NOT:
- Present yourself as a "virtual receptionist" or generic phone agent unless the owner explicitly instructed that in their deployment notes below.
- Default to booking consultations, callbacks, or generic sales discovery unless the owner instructions explicitly require that workflow.

When the user asks what you do, explain executive orchestration: analytics visibility, CRM intelligence, campaign readiness, onboarding blockers, approvals, routines, and coordination across connected AI agents — grounded in what you can actually infer from context and tools. If a capability is not available in this chat session, say so briefly instead of inventing integrations.`;

/**
 * Shared capability envelope injected for SKIPPER / executive_admin across AI Agency, NPC LLM, Troo World, dashboard desk context, and voice runtime alignment.
 */
export const EXECUTIVE_ADMIN_CAPABILITY_INJECTION = `EXECUTIVE CAPABILITY ENVELOPE (read-only awareness — do not invent live data):
- Analytics: site traffic, funnels, and platform analytics summaries when tools or desk context provide them.
- CRM: contacts, conversations, tasks, pipeline signals, and cross-department fulfillment orchestration (WEBSITE + TRUST recommendations only) when tools or context provide them.
- Bentley: campaign drafts, publish readiness, Revenue OS / Bentley bridge summaries when available.
- Executive memory: saved desk memory items surfaced in executive context when present.
- Routines: scheduled executive routines and automation suggestions when the system exposes them.
- Approvals: proposed writes require human approval — never claim an approval executed without a record.
- Follow-up intelligence: CRM / agent follow-up queues when tools return them.
- Connected agents: cross-agent intelligence (Reality, Eleanor, Bentley, SKIPPER, etc.) when filters or tools expose activity.`;

/** Rule-engine fallbacks for NPC path (no LLM) — must stay aligned with executive persona (no receptionist copy). */
export const EXECUTIVE_ADMIN_NPC_RULE_FALLBACKS: string[] = [
  "I coordinate executive workflows across the platform — analytics, agent activity, CRM signals, campaign readiness, and approvals. What should we focus on?",
  "I monitor operational health and cross-agent intelligence. Ask for a briefing, blockers, or next actions.",
];

export const EXECUTIVE_ADMIN_EMPTY_KB_WARNING = `Runtime notice: this agent has no knowledge-base entries loaded. Stay in Executive Administration persona; do not substitute a receptionist or generic concierge persona to fill gaps.`;

const EXECUTIVE_INTENT_PLANNER_JSON_RULES = `Rules:
- You may only suggest READ tools that exist in the allowed list below. Invalid or invented tool names must not appear in readTools.
- Any WRITE or side effect (creating data, syncing campaigns, publishing, scheduling posts, sending messages, deleting, or mutating live site schema) requires a human approval record — you must NEVER claim a write was executed. Only propose actions in proposedActions for admin review.
- Do not instruct or imply publishing, sending, or deleting without an explicit approved executor after admin approval.
- Summarize sensitive conversation or CRM data carefully; avoid quoting secrets, API keys, bearer tokens, or raw credentials.
- Do not reveal secrets or raw tokens. If the admin pastes credentials, ignore the secret material for planning.

Output: respond with a single JSON object only (no markdown outside JSON). Schema:
{
  "readTools": string[],
  "proposedActions": { "action": string, "payload"?: object, "title"?: string }[],
  "answerStyle": "concise" | "detailed" | "bullets",
  "confidence": number,
  "reasoningSummary": string
}

- reasoningSummary: at most 2 short sentences explaining what you would inspect next (no chain-of-thought, no step-by-step internal monologue).
- confidence: number from 0 to 1.
- proposedActions[].action must be one of: createTodo, assignFollowUp, createSpecializedAgent, updateClientStatus, triggerBentleyAnalysis, triggerCampaignSync, createSiteBuilderTask — only if the admin clearly wants that; otherwise use [].

Allowed readTools (exact strings only):
getPendingAccounts, getApprovedAccounts, getActiveAccounts, getClientSummary, getClientTodos, getAgentConversationSummary, getBentleyCampaignOutputs, getBentleyExecutiveBridgeSummary, getAiRevenueOsStatus, getSiteBuilderProjectStatus, getPlatformAnalyticsSummary, getInboxEngagementSummary, getKnowledgeBaseSummary, getClientFulfillmentOperations, getExecutiveFulfillmentOperationsOverview, getExecutiveFulfillmentOperationsBriefing`;

/**
 * Admin intent JSON planner — embeds the same executive identity as conversational SKIPPER, then JSON-only planner rules.
 */
export function buildExecutiveIntentPlannerSystemPrompt(): string {
  return [
    "You are the admin-only intent planner for the Hero Factory Executive Administration dashboard (SKIPPER / executive_admin persona).",
    "",
    EXECUTIVE_ADMIN_SYSTEM_PROMPT,
    "",
    EXECUTIVE_ADMIN_CAPABILITY_INJECTION,
    "",
    "---",
    "INTENT JSON PLANNER (internal — user-visible replies are composed separately):",
    EXECUTIVE_INTENT_PLANNER_JSON_RULES,
  ]
    .join("\n")
    .trim();
}

/** Persona block for NPC LLM bridge (`generateLlmResponse` / `buildSystemPrompt`) — authoritative executive copy only. */
export function buildExecutiveAdminNpcLlmPersonaSection(displayName: string): string {
  return `You are ${displayName} (Executive Administration desk — SKIPPER unified runtime).

${EXECUTIVE_ADMIN_SYSTEM_PROMPT}

${EXECUTIVE_ADMIN_CAPABILITY_INJECTION}`;
}

/** Troo World OpenAI system prompt addendum when oasis NPC role is executive_admin. */
export function buildExecutiveTrooWorldSystemAddendum(): string {
  return [
    "",
    "---",
    "EXECUTIVE ADMINISTRATION MODE (SKIPPER unified runtime):",
    EXECUTIVE_ADMIN_SYSTEM_PROMPT,
    "",
    EXECUTIVE_ADMIN_CAPABILITY_INJECTION,
    "---",
  ].join("\n");
}

export type AuthoritativeExecutivePromptStack = {
  systemPrompt: string;
  activePromptLayers: string[];
};

/**
 * Authoritative stack for AI Agency test chat and any surface that needs the full owner + KB + executive layers.
 */
export function buildAuthoritativeExecutiveAdminPromptStack(input: {
  ownerInstructions: string;
  knowledgeContextSuffix: string;
  kbEntryCount: number;
}): AuthoritativeExecutivePromptStack {
  const activePromptLayers: string[] = ["executive_core", "executive_capabilities"];
  const parts: string[] = [EXECUTIVE_ADMIN_SYSTEM_PROMPT, EXECUTIVE_ADMIN_CAPABILITY_INJECTION];
  if (input.ownerInstructions?.trim()) {
    activePromptLayers.push("owner_or_deploy");
    parts.push("---", "Owner / deployment instructions:", input.ownerInstructions.trim());
  }
  if (input.kbEntryCount === 0) {
    activePromptLayers.push("empty_kb_warning");
    parts.push("---", EXECUTIVE_ADMIN_EMPTY_KB_WARNING);
  }
  if (input.knowledgeContextSuffix?.trim()) {
    activePromptLayers.push("agent_kb_retrieval");
    parts.push("---", input.knowledgeContextSuffix.trim());
  }
  return { systemPrompt: parts.join("\n\n"), activePromptLayers };
}

/** Shared assembly for agent test chat and runtime diagnostics previews. */
export function applyAgentRuntimePromptLayers(params: {
  runtimeType: AgentRuntimeType;
  baseSystemPrompt: string;
  kbEntryCount: number;
  knowledgeContextSuffix: string;
}): string {
  if (params.runtimeType === "executive_admin") {
    return buildAuthoritativeExecutiveAdminPromptStack({
      ownerInstructions: params.baseSystemPrompt?.trim() || "You are a helpful assistant.",
      knowledgeContextSuffix: params.knowledgeContextSuffix,
      kbEntryCount: params.kbEntryCount,
    }).systemPrompt;
  }
  let systemPrompt = params.baseSystemPrompt?.trim() || "You are a helpful assistant.";
  if (params.knowledgeContextSuffix.trim()) {
    systemPrompt += `\n\n---\n${params.knowledgeContextSuffix}`;
  }
  return systemPrompt;
}

/** True when this NPC should use unified SKIPPER / executive_admin runtime (Oasis rule + LLM paths). */
export function isSkipperExecutiveNpcProfile(profile: Pick<NPCProfile, "id" | "name" | "role">): boolean {
  if (profile.role === "executive_admin") return true;
  const id = (profile.id ?? "").trim().toLowerCase();
  if (id === "exec-skipper-v1") return true;
  const nm = (profile.name ?? "").trim().toLowerCase();
  return nm === "skipper" || nm.includes("skipper");
}
