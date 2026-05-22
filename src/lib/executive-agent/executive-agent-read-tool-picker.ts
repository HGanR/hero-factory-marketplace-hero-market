/**
 * Pure selection of read tools for the executive orchestrator (no server-only).
 */

export type ExecutiveReadToolKey =
  | "getPendingAccounts"
  | "getPendingClientsQueue"
  | "getApprovedAccounts"
  | "getActiveAccounts"
  | "getClientSummary"
  | "getClientTodos"
  | "getAgentConversationSummary"
  | "getBentleyCampaignOutputs"
  | "getBentleyExecutiveBridgeSummary"
  | "getAiRevenueOsStatus"
  | "getSiteBuilderProjectStatus"
  | "getPlatformAnalyticsSummary"
  | "getInboxEngagementSummary"
  | "getKnowledgeBaseSummary"
  | "getClientFulfillmentOperations"
  | "getExecutiveFulfillmentOperationsOverview"
  | "getExecutiveFulfillmentOperationsBriefing"
  | "getExecutiveFulfillmentOperationsMemoryInsights"
  | "getExecutiveSubjectWorkspace"
  | "getExecutiveOperationalThreads"
  | "getExecutivePendingDecisions"
  | "getExecutiveOperationalTasks"
  | "getExecutiveRevenueOsFulfillment"
  | "getExecutiveSmartTrustFulfillment"
  | "getExecutiveKpiOverview"
  | "getExecutiveKpiForecast";

const READ_ALIASES: Record<string, ExecutiveReadToolKey> = {
  getPendingAccounts: "getPendingAccounts",
  getPendingClientsQueue: "getPendingClientsQueue",
  getApprovedAccounts: "getApprovedAccounts",
  getActiveAccounts: "getActiveAccounts",
  getClientSummary: "getClientSummary",
  getClientTodos: "getClientTodos",
  getAgentConversationSummary: "getAgentConversationSummary",
  getBentleyCampaignOutputs: "getBentleyCampaignOutputs",
  getBentleyExecutiveBridgeSummary: "getBentleyExecutiveBridgeSummary",
  getAiRevenueOsStatus: "getAiRevenueOsStatus",
  getSiteBuilderProjectStatus: "getSiteBuilderProjectStatus",
  getPlatformAnalyticsSummary: "getPlatformAnalyticsSummary",
  getInboxEngagementSummary: "getInboxEngagementSummary",
  getKnowledgeBaseSummary: "getKnowledgeBaseSummary",
  getClientFulfillmentOperations: "getClientFulfillmentOperations",
  getExecutiveFulfillmentOperationsOverview: "getExecutiveFulfillmentOperationsOverview",
  getExecutiveFulfillmentOperationsBriefing: "getExecutiveFulfillmentOperationsBriefing",
  getExecutiveFulfillmentOperationsMemoryInsights: "getExecutiveFulfillmentOperationsMemoryInsights",
  getExecutiveSubjectWorkspace: "getExecutiveSubjectWorkspace",
  getExecutiveOperationalThreads: "getExecutiveOperationalThreads",
  getExecutivePendingDecisions: "getExecutivePendingDecisions",
  getExecutiveOperationalTasks: "getExecutiveOperationalTasks",
  getExecutiveRevenueOsFulfillment: "getExecutiveRevenueOsFulfillment",
  getExecutiveSmartTrustFulfillment: "getExecutiveSmartTrustFulfillment",
  getExecutiveKpiOverview: "getExecutiveKpiOverview",
  getExecutiveKpiForecast: "getExecutiveKpiForecast",
};

export function resolveExecutiveReadToolKey(name: string): ExecutiveReadToolKey | null {
  const k = name.trim();
  if (!k || !(k in READ_ALIASES)) return null;
  return READ_ALIASES[k]!;
}

export type PickReadToolsOptions = {
  dashboardMode?: string | null;
  selectedAgents?: string[] | null;
};

export function pickExecutiveReadTools(
  prompt: string,
  requested: string | null | undefined,
  opts?: PickReadToolsOptions | null,
): ExecutiveReadToolKey[] {
  const p = prompt.toLowerCase();
  const out = new Set<ExecutiveReadToolKey>();
  const req = requested?.trim();
  if (req && req in READ_ALIASES) {
    out.add(READ_ALIASES[req]!);
  }
  if (/pending|awaiting review|not approved/.test(p)) {
    out.add("getPendingAccounts");
    out.add("getPendingClientsQueue");
  }
  if (/pending client|intake queue|signup queue|new client/.test(p)) out.add("getPendingClientsQueue");
  if (/approved|active account/.test(p)) {
    out.add("getApprovedAccounts");
    out.add("getActiveAccounts");
  }
  if (/how many.*active|active user/.test(p)) out.add("getActiveAccounts");
  if (/follow up|today|todo|notes/.test(p)) out.add("getClientTodos");
  if (/client|crm|summary/.test(p) && !out.size) out.add("getClientSummary");
  if (/bentley|campaign output|revenue os|scheduled post/.test(p)) {
    out.add("getBentleyCampaignOutputs");
    out.add("getAiRevenueOsStatus");
    out.add("getExecutiveRevenueOsFulfillment");
  }
  if (
    /campaign fulfillment|launch readiness|launch blocker|kpi health|revision pattern|stalled campaign|campaign review packet|revenue.?os fulfillment/.test(
      p
    )
  ) {
    out.add("getExecutiveRevenueOsFulfillment");
    out.add("getBentleyExecutiveBridgeSummary");
  }
  if (/bentley cadence|executive bridge|launch readiness|blocked post|pending approval/.test(p)) {
    out.add("getBentleyExecutiveBridgeSummary");
  }
  if (/site builder|website|web3 site/.test(p)) out.add("getSiteBuilderProjectStatus");
  if (/agent.*conversation|discussed|chat/.test(p)) out.add("getAgentConversationSummary");
  if (/inbox|engagement|dm/.test(p)) out.add("getInboxEngagementSummary");
  if (
    /smart trust|governance review|trust resolution|trust governance|trustee workflow|amendment review|compliance reminder|minutes record|smart_trust fulfillment/.test(
      p
    )
  ) {
    out.add("getExecutiveSmartTrustFulfillment");
    out.add("getExecutiveSubjectWorkspace");
  }
  if (/fulfillment|website order|trust order|trust packet|site builder draft|owner review|payment confirm/.test(p)) {
    out.add("getClientFulfillmentOperations");
  }
  if (/cross-department|multi-department|operations overview|fulfillment queue|bottleneck|stalled client|sequencing/.test(p)) {
    out.add("getExecutiveFulfillmentOperationsOverview");
    out.add("getClientFulfillmentOperations");
  }
  if (/briefing|needs my attention|urgent action|owner sequence|operations briefing/.test(p)) {
    out.add("getExecutiveFulfillmentOperationsBriefing");
  }
  if (
    /operational memory|memory insight|learned pattern|revision analytics|approval latency|bottleneck recurrence|what.*prioriti|fulfillment success score/.test(
      p
    )
  ) {
    out.add("getExecutiveFulfillmentOperationsMemoryInsights");
    out.add("getExecutiveSubjectWorkspace");
  }
  if (/subject workspace|active subject|workspace context|department focus|fulfillment case/.test(p)) {
    out.add("getExecutiveSubjectWorkspace");
    out.add("getClientFulfillmentOperations");
  }
  if (
    /operational thread|ops thread|internal discussion|decision needed|unresolved question|approval discussion|department messaging|operational note/.test(
      p
    )
  ) {
    out.add("getExecutiveOperationalThreads");
    out.add("getExecutiveSubjectWorkspace");
  }
  if (
    /pending decision|decision queue|owner decision|what.*decide|deferred decision|record decision|decision ledger/.test(
      p
    )
  ) {
    out.add("getExecutivePendingDecisions");
    out.add("getExecutiveOperationalThreads");
  }
  if (
    /operational task|task queue|blocked task|overdue task|what.*next.*action|task depend|fulfillment bottleneck.*task/.test(
      p
    )
  ) {
    out.add("getExecutiveOperationalTasks");
    out.add("getExecutivePendingDecisions");
    out.add("getClientFulfillmentOperations");
  }
  if (/what.*client still need|what department|fulfillment-ready|depends on trust|depends on website|ai revenue os onboarding|operational bottleneck/.test(p)) {
    out.add("getClientFulfillmentOperations");
  }
  if (/knowledge|kb|docs/.test(p)) out.add("getKnowledgeBaseSummary");
  if (
    /kpi|forecast|projected delay|operational health score|fulfillment velocity|workload balance|revision risk|approval delay forecast|risk alert|backlog forecast|bottleneck forecast|department overload/.test(
      p
    )
  ) {
    out.add("getExecutiveKpiOverview");
    out.add("getExecutiveKpiForecast");
  }
  if (/forecast only|fulfillment forecast|projected stall/.test(p)) {
    out.add("getExecutiveKpiForecast");
  }
  if (/desk health|velocity analytics|kpi overview/.test(p)) {
    out.add("getExecutiveKpiOverview");
  }
  if (/analytics|health|blocking|underperform/.test(p)) {
    out.add("getPlatformAnalyticsSummary");
    out.add("getInboxEngagementSummary");
    out.add("getExecutiveKpiOverview");
  }
  if (/voice\s+follow-up.*analytics/i.test(p)) {
    out.add("getPlatformAnalyticsSummary");
  }

  const mode = opts?.dashboardMode?.trim().toUpperCase() ?? null;
  if (mode === "CONVERSATIONS") {
    out.add("getAgentConversationSummary");
    out.add("getInboxEngagementSummary");
  }
  if (mode === "REVENUE" || mode === "CAMPAIGNS") {
    out.add("getBentleyCampaignOutputs");
    out.add("getAiRevenueOsStatus");
    out.add("getBentleyExecutiveBridgeSummary");
    out.add("getExecutiveRevenueOsFulfillment");
    out.add("getPlatformAnalyticsSummary");
  }
  if (mode === "CRM") {
    out.add("getClientSummary");
    out.add("getClientTodos");
    out.add("getApprovedAccounts");
    out.add("getPendingAccounts");
    out.add("getPendingClientsQueue");
    out.add("getClientFulfillmentOperations");
  }
  if (mode === "SITE_BUILDER") {
    out.add("getSiteBuilderProjectStatus");
  }
  if (mode === "TASKS") {
    out.add("getClientTodos");
  }
  if (mode === "SYSTEM_HEALTH") {
    out.add("getPlatformAnalyticsSummary");
    out.add("getInboxEngagementSummary");
    out.add("getKnowledgeBaseSummary");
  }
  if (mode === "OVERVIEW") {
    out.add("getPlatformAnalyticsSummary");
    out.add("getPendingAccounts");
    out.add("getApprovedAccounts");
    out.add("getActiveAccounts");
  }

  const agents = opts?.selectedAgents?.map((a) => a.toLowerCase()) ?? [];
  if (agents.includes("bentley")) {
    out.add("getBentleyCampaignOutputs");
    out.add("getAiRevenueOsStatus");
    out.add("getBentleyExecutiveBridgeSummary");
  }
  if (agents.some((a) => a === "reality" || a === "eleanor")) {
    out.add("getAgentConversationSummary");
  }

  if (out.size === 0) {
    out.add("getPlatformAnalyticsSummary");
    out.add("getPendingAccounts");
    out.add("getApprovedAccounts");
  }
  return [...out];
}
