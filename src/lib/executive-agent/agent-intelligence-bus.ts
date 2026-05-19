/**
 * Normalized agent intelligence for Executive Administration UI and APIs.
 * Prefer `source: "not_configured"` over invented per-agent metrics when tables are absent.
 */

export const EXECUTIVE_AGENT_KEYS = ["reality", "eleanor", "bentley", "executive_admin", "skipper"] as const;

export type ExecutiveAgentKey = (typeof EXECUTIVE_AGENT_KEYS)[number];

export type AgentIntelligenceSource = "db" | "partial" | "not_configured";

export type AgentIntelligenceStatus = "online" | "offline" | "degraded" | "unknown";

export type AgentIntelligenceRecord = {
  agentKey: ExecutiveAgentKey;
  displayName: string;
  status: AgentIntelligenceStatus;
  activeConversations: number | null;
  totalConversations: number | null;
  leadsCaptured: number | null;
  recommendations: number | null;
  alerts: number | null;
  lastActivityAt: string | null;
  performanceScore: number | null;
  source: AgentIntelligenceSource;
  /** Present when metrics are placeholders or partially wired. */
  note?: string;
};

export type AgentIntelligenceAggregate = {
  selectedAgentCount: number;
  totalActiveConversations: number | null;
  totalLeadsCaptured: number | null;
  totalAlerts: number | null;
  averagePerformanceScore: number | null;
  source: AgentIntelligenceSource;
};

const DISPLAY: Record<ExecutiveAgentKey, string> = {
  reality: "Reality",
  eleanor: "Eleanor",
  bentley: "Bentley",
  executive_admin: "Executive Admin",
  skipper: "SKIPPER",
};

export function isExecutiveAgentKey(s: string): s is ExecutiveAgentKey {
  return (EXECUTIVE_AGENT_KEYS as readonly string[]).includes(s);
}

/** Baseline rows when no per-agent analytics tables exist. */
export function createDefaultAgentIntelligenceRecords(): AgentIntelligenceRecord[] {
  return EXECUTIVE_AGENT_KEYS.map((key) => ({
    agentKey: key,
    displayName: DISPLAY[key],
    status: "unknown",
    activeConversations: null,
    totalConversations: null,
    leadsCaptured: null,
    recommendations: null,
    alerts: null,
    lastActivityAt: null,
    performanceScore: null,
    source: "not_configured",
    note: "Conversation metrics load from configured tables only — none inferred here.",
  }));
}

export function parseAgentKeysQuery(param: string | null): ExecutiveAgentKey[] | null {
  if (param == null || param.trim() === "") return null;
  const parts = param
    .split(/[, ]+/)
    .map((s) => s.trim().toLowerCase().replace(/-/g, "_"))
    .filter(Boolean);
  const out: ExecutiveAgentKey[] = [];
  for (const p of parts) {
    const normalized = p === "executive" ? "executive_admin" : p === "exec" ? "executive_admin" : p;
    if (isExecutiveAgentKey(normalized)) out.push(normalized);
  }
  return out.length ? [...new Set(out)] : null;
}

export function filterAgentsByKeys(
  agents: AgentIntelligenceRecord[],
  keys: ExecutiveAgentKey[] | null | undefined,
): AgentIntelligenceRecord[] {
  if (!keys?.length) return agents;
  const set = new Set(keys);
  return agents.filter((a) => set.has(a.agentKey));
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a + b;
}

function avgNullable(scores: Array<number | null>): number | null {
  const nums = scores.filter((x): x is number => x != null && Number.isFinite(x));
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function aggregateAgentIntelligence(agents: AgentIntelligenceRecord[]): AgentIntelligenceAggregate {
  const selectedAgentCount = agents.length;
  let totalActiveConversations: number | null = null;
  let totalLeadsCaptured: number | null = null;
  let totalAlerts: number | null = null;
  for (const a of agents) {
    totalActiveConversations = sumNullable(totalActiveConversations, a.activeConversations);
    totalLeadsCaptured = sumNullable(totalLeadsCaptured, a.leadsCaptured);
    totalAlerts = sumNullable(totalAlerts, a.alerts);
  }
  const averagePerformanceScore = avgNullable(agents.map((a) => a.performanceScore));
  const anyDb = agents.some((a) => a.source === "db");
  const anyPartial = agents.some((a) => a.source === "partial");
  const source: AgentIntelligenceSource = anyDb ? "db" : anyPartial ? "partial" : "not_configured";
  return {
    selectedAgentCount,
    totalActiveConversations,
    totalLeadsCaptured,
    totalAlerts,
    averagePerformanceScore,
    source,
  };
}

export function buildAgentIntelligenceResponse(agents: AgentIntelligenceRecord[]): {
  agents: AgentIntelligenceRecord[];
  aggregate: AgentIntelligenceAggregate;
} {
  return {
    agents,
    aggregate: aggregateAgentIntelligence(agents),
  };
}
