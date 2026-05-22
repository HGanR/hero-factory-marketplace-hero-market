/**
 * Permission scopes for the Executive Administration Agent.
 * All `write:*` scopes require an explicit approval row before any executor runs.
 */
export const EXECUTIVE_AGENT_SCOPES = [
  "read:crm",
  "read:agents",
  "read:analytics",
  "read:bentley",
  "read:site-builder",
  "write:todos",
  "write:agents",
  "write:campaigns",
  "write:clients",
] as const;

export type ExecutiveAgentScope = (typeof EXECUTIVE_AGENT_SCOPES)[number];

export const READ_SCOPES: ExecutiveAgentScope[] = [
  "read:crm",
  "read:agents",
  "read:analytics",
  "read:bentley",
  "read:site-builder",
];

export const WRITE_SCOPES: ExecutiveAgentScope[] = [
  "write:todos",
  "write:agents",
  "write:campaigns",
  "write:clients",
];

export const WRITE_ACTION_NAMES = [
  "createTodo",
  "assignFollowUp",
  "createSpecializedAgent",
  "updateClientStatus",
  "triggerBentleyAnalysis",
  "triggerCampaignSync",
  "createSiteBuilderTask",
  "createTrustFulfillmentPacket",
  "createRevenueOsCampaignReviewPacket",
  "recordRevenueOsLaunchReadinessCheckpoint",
  "createSmartTrustGovernanceReviewPacket",
  "recordSmartTrustResolutionCheckpoint",
] as const;

export type ExecutiveWriteActionName = (typeof WRITE_ACTION_NAMES)[number];

export function scopeForWriteAction(action: string): ExecutiveAgentScope | null {
  switch (action) {
    case "createTodo":
    case "assignFollowUp":
    case "createSiteBuilderTask":
    case "createTrustFulfillmentPacket":
    case "createRevenueOsCampaignReviewPacket":
    case "recordRevenueOsLaunchReadinessCheckpoint":
    case "createSmartTrustGovernanceReviewPacket":
    case "recordSmartTrustResolutionCheckpoint":
      return "write:todos";
    case "createSpecializedAgent":
      return "write:agents";
    case "triggerBentleyAnalysis":
    case "triggerCampaignSync":
      return "write:campaigns";
    case "updateClientStatus":
      return "write:clients";
    default:
      return null;
  }
}

export function isWriteAction(action: string): action is ExecutiveWriteActionName {
  return (WRITE_ACTION_NAMES as readonly string[]).includes(action);
}

export function writeActionRequiresApproval(_action: ExecutiveWriteActionName): true {
  return true;
}

export function canInvokeReadTool(toolName: string, granted: Set<ExecutiveAgentScope>): boolean {
  const map: Record<string, ExecutiveAgentScope> = {
    getPendingAccounts: "read:crm",
    getPendingClientsQueue: "read:crm",
    getApprovedAccounts: "read:crm",
    getActiveAccounts: "read:crm",
    getClientSummary: "read:crm",
    getClientTodos: "read:crm",
    getAgentConversationSummary: "read:agents",
    getBentleyCampaignOutputs: "read:bentley",
    getBentleyExecutiveBridgeSummary: "read:bentley",
    getAiRevenueOsStatus: "read:bentley",
    getSiteBuilderProjectStatus: "read:site-builder",
    getPlatformAnalyticsSummary: "read:analytics",
    getInboxEngagementSummary: "read:analytics",
    getKnowledgeBaseSummary: "read:analytics",
    getClientFulfillmentOperations: "read:crm",
    getExecutiveFulfillmentOperationsOverview: "read:crm",
    getExecutiveFulfillmentOperationsBriefing: "read:crm",
    getExecutiveFulfillmentOperationsMemoryInsights: "read:crm",
    getExecutiveSubjectWorkspace: "read:crm",
    getExecutiveOperationalThreads: "read:crm",
    getExecutivePendingDecisions: "read:crm",
    getExecutiveOperationalTasks: "read:crm",
    getExecutiveRevenueOsFulfillment: "read:bentley",
    getExecutiveSmartTrustFulfillment: "read:crm",
    getExecutiveKpiOverview: "read:crm",
    getExecutiveKpiForecast: "read:crm",
  };
  const need = map[toolName];
  if (!need) return false;
  return granted.has(need);
}

/** Default full read scope for authenticated executive admin sessions. */
export function defaultExecutiveReadScopes(): ExecutiveAgentScope[] {
  return [...READ_SCOPES];
}
