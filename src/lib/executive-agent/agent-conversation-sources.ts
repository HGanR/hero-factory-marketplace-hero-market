/**
 * Catalog of conversation-like data the Executive layer may read.
 * Keys are stable identifiers for audit/UI — not every row maps 1:1 to Reality/Eleanor/Bentley.
 */

export type ConversationSourceConfidence = "high" | "medium" | "low";

export type DescriptorAgentKey = "reality" | "eleanor" | "bentley" | "executive_admin" | "multi_tenant" | "unmapped";

export type AgentConversationSourceDescriptor = {
  sourceKey: string;
  tableNameOrRoute: string;
  agentKey: DescriptorAgentKey;
  hasClientId: boolean;
  hasUserId: boolean;
  hasMessageText: boolean;
  hasCreatedAt: boolean;
  confidence: ConversationSourceConfidence;
  notes: string;
};

/**
 * Declarative map aligned to Drizzle tables under `src/lib/db/schema*.ts`
 * and widget DDL in `widget-conversation-ensure.ts`.
 */
export const EXECUTIVE_AGENT_CONVERSATION_SOURCES: readonly AgentConversationSourceDescriptor[] = [
  {
    sourceKey: "widget_conversations",
    tableNameOrRoute: "widget_conversations + widget_messages",
    agentKey: "multi_tenant",
    hasClientId: false,
    hasUserId: true,
    hasMessageText: true,
    hasCreatedAt: true,
    confidence: "high",
    notes:
      "Site widget threads; `agent_id` joins `ai_agents` for heuristic mapping to executive personas (name match only).",
  },
  {
    sourceKey: "crm_conversations",
    tableNameOrRoute: "crm_conversations + crm_messages",
    agentKey: "executive_admin",
    hasClientId: true,
    hasUserId: true,
    hasMessageText: true,
    hasCreatedAt: true,
    confidence: "medium",
    notes: "CRM SMS/email threads — not branded Reality/Eleanor; surfaced as executive-admin signal only.",
  },
  {
    sourceKey: "social_engagement_threads",
    tableNameOrRoute: "social_engagement_threads + social_engagement_messages",
    agentKey: "executive_admin",
    hasClientId: true,
    hasUserId: false,
    hasMessageText: true,
    hasCreatedAt: true,
    confidence: "high",
    notes: "Inbox/DM engagement pipeline; counts roll up to Executive Admin intelligence, not per persona.",
  },
  {
    sourceKey: "executive_agent_audit_logs",
    tableNameOrRoute: "executive_agent_audit_logs (platform extras)",
    agentKey: "executive_admin",
    hasClientId: false,
    hasUserId: true,
    hasMessageText: true,
    hasCreatedAt: true,
    confidence: "high",
    notes: "Orchestrator audit rows include prompts and tool IO — admin-only; used for activity, not widget parity.",
  },
  {
    sourceKey: "bentley_campaign_posts",
    tableNameOrRoute: "campaign_posts (+ campaigns)",
    agentKey: "bentley",
    hasClientId: true,
    hasUserId: false,
    hasMessageText: true,
    hasCreatedAt: true,
    confidence: "medium",
    notes: "Scheduled/generated social payloads — operational, not free-form chat; complements Bentley bridge.",
  },
] as const;

export function getConversationSourceByKey(key: string): AgentConversationSourceDescriptor | undefined {
  return EXECUTIVE_AGENT_CONVERSATION_SOURCES.find((s) => s.sourceKey === key);
}
