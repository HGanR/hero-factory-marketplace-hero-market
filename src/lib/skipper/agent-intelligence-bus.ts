/**
 * Agent Intelligence Bus — aggregate shape for Executive / Skipper UI.
 * Replace mock pulses with live API feeds when available.
 */
export type AgentPulseStatus = "online" | "idle" | "busy" | "offline";

export type AgentIntelligenceSnapshot = {
  agentId: string;
  displayName: string;
  status: AgentPulseStatus;
  activeUsers: number;
  conversations: number;
  sentiment: "positive" | "neutral" | "concern";
  campaigns: number;
  alerts: number;
  recommendations: number;
  lastActivityMs: number;
  performanceScore: number;
};

export const MOCK_AGENT_BUS: AgentIntelligenceSnapshot[] = [
  {
    agentId: "reality",
    displayName: "Reality",
    status: "online",
    activeUsers: 412,
    conversations: 89,
    sentiment: "positive",
    campaigns: 12,
    alerts: 1,
    recommendations: 4,
    lastActivityMs: 2_000,
    performanceScore: 0.91,
  },
  {
    agentId: "eleanor",
    displayName: "Eleanor",
    status: "online",
    activeUsers: 628,
    conversations: 156,
    sentiment: "positive",
    campaigns: 8,
    alerts: 0,
    recommendations: 7,
    lastActivityMs: 4_500,
    performanceScore: 0.88,
  },
  {
    agentId: "bentley",
    displayName: "Bentley",
    status: "online",
    activeUsers: 204,
    conversations: 42,
    sentiment: "neutral",
    campaigns: 23,
    alerts: 2,
    recommendations: 5,
    lastActivityMs: 8_000,
    performanceScore: 0.78,
  },
  {
    agentId: "executive-admin",
    displayName: "Executive Admin",
    status: "busy",
    activeUsers: 1,
    conversations: 3,
    sentiment: "neutral",
    campaigns: 0,
    alerts: 0,
    recommendations: 2,
    lastActivityMs: 500,
    performanceScore: 0.95,
  },
];
