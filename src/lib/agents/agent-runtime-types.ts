/**
 * Discriminator for AI Agency agent test / widget runtime behavior.
 * Stored on `ai_agents.agentRuntimeType`; name-based fallback for legacy SKIPPER rows.
 */

export const AGENT_RUNTIME_TYPES = [
  "general",
  "receptionist",
  "executive_admin",
  "revenue_operator",
  "trust_advisor",
  "concierge",
] as const;

export type AgentRuntimeType = (typeof AGENT_RUNTIME_TYPES)[number];

function isKnownRuntime(s: string): s is AgentRuntimeType {
  return (AGENT_RUNTIME_TYPES as readonly string[]).includes(s);
}

export function resolveAgentRuntimeType(params: {
  agentRuntimeType: string | null | undefined;
  name: string | null | undefined;
}): AgentRuntimeType {
  const raw = (params.agentRuntimeType ?? "").trim().toLowerCase();
  if (raw && isKnownRuntime(raw)) return raw;
  const name = (params.name ?? "").trim().toUpperCase();
  if (name === "SKIPPER") return "executive_admin";
  return "general";
}

export function isExecutiveAdminRuntime(t: AgentRuntimeType): boolean {
  return t === "executive_admin";
}
