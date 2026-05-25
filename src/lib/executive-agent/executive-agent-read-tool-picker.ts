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
  | "getExecutiveKpiForecast"
  | "getExecutiveOperatorRegistry"
  | "getExecutiveOperatorWorkload"
  | "getExecutiveSimulationOverview"
  | "runExecutiveSimulation"
  | "getExecutiveKnowledgeOverview"
  | "getExecutiveKnowledgeClient"
  | "getExecutiveKnowledgeOperator"
  | "getExecutivePlanningOverview"
  | "generateExecutivePlan"
  | "getExecutiveCommandOverview"
  | "getExecutiveCommandIncidents"
  | "getExecutiveCommandAlerts"
  | "getJarvaActivityToday"
  | "getRealityActivityToday"
  | "getExecutiveInboxNewMessages"
  | "playExecutiveInboxAudioAttachment"
  | "getNewRegistrationsToday"
  | "getNewRegistrationPhoneQueue"
  | "getNeuroSourceAnswer";

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
  getExecutiveOperatorRegistry: "getExecutiveOperatorRegistry",
  getExecutiveOperatorWorkload: "getExecutiveOperatorWorkload",
  getExecutiveSimulationOverview: "getExecutiveSimulationOverview",
  runExecutiveSimulation: "runExecutiveSimulation",
  getExecutiveKnowledgeOverview: "getExecutiveKnowledgeOverview",
  getExecutiveKnowledgeClient: "getExecutiveKnowledgeClient",
  getExecutiveKnowledgeOperator: "getExecutiveKnowledgeOperator",
  getExecutivePlanningOverview: "getExecutivePlanningOverview",
  generateExecutivePlan: "generateExecutivePlan",
  getExecutiveCommandOverview: "getExecutiveCommandOverview",
  getExecutiveCommandIncidents: "getExecutiveCommandIncidents",
  getExecutiveCommandAlerts: "getExecutiveCommandAlerts",
  getJarvaActivityToday: "getJarvaActivityToday",
  getRealityActivityToday: "getRealityActivityToday",
  getExecutiveInboxNewMessages: "getExecutiveInboxNewMessages",
  playExecutiveInboxAudioAttachment: "playExecutiveInboxAudioAttachment",
  getNewRegistrationsToday: "getNewRegistrationsToday",
  getNewRegistrationPhoneQueue: "getNewRegistrationPhoneQueue",
  getNeuroSourceAnswer: "getNeuroSourceAnswer",
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
  if (/inbox|engagement|dm/.test(p)) {
    out.add("getInboxEngagementSummary");
    if (/executive inbox|new message|inbox signal/.test(p)) out.add("getExecutiveInboxNewMessages");
  }
  if (/\b(jarva|smart trust|trust records)\b.*\b(activity|conversation|today|spoke)\b/.test(p)) {
    out.add("getJarvaActivityToday");
  }
  if (/\bsmart trust\b.*\bactivity\b/.test(p)) out.add("getJarvaActivityToday");
  if (/\breality\b.*\b(activity|conversation|today)\b/.test(p)) out.add("getRealityActivityToday");
  if (/\b(new registrations?|new visitors?|sign.?ups?|registered today|pending accounts?)\b/.test(p)) {
    out.add("getNewRegistrationsToday");
  }
  if (/phone number.*(new account|registration|onboard)/.test(p)) out.add("getNewRegistrationPhoneQueue");
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
    out.add("getExecutiveOperatorWorkload");
  }
  if (
    /operator workload|delegation|escalat|overloaded operator|workforce|staffing|operator performance|delegation queue|escalation chain|operator registry/.test(
      p
    )
  ) {
    out.add("getExecutiveOperatorRegistry");
    out.add("getExecutiveOperatorWorkload");
  }
  if (
    /simulation|what if|scenario compare|timeline simulation|bottleneck cascade|launch probability|governance stagnation|redistribution outcome|approval delay impact|simulate desk/.test(
      p
    )
  ) {
    out.add("getExecutiveSimulationOverview");
    out.add("runExecutiveSimulation");
  }
  if (/run simulation|simulate scenario|approval_delay|operator_redistribution/.test(p)) {
    out.add("runExecutiveSimulation");
  }
  if (
    /knowledge graph|strategic memory|long.?horizon|organizational pattern|institutional bottleneck|operator specialization|client trajectory|department evolution|historical context|executive knowledge|persistent memory|recurring pattern/.test(
      p
    )
  ) {
    out.add("getExecutiveKnowledgeOverview");
    out.add("getExecutiveKnowledgeClient");
    out.add("getExecutiveKnowledgeOperator");
  }
  if (/client trajectory|client lifecycle intelligence|long.?term client/.test(p)) {
    out.add("getExecutiveKnowledgeClient");
  }
  if (/operator specialization|operator history|operator evolution/.test(p)) {
    out.add("getExecutiveKnowledgeOperator");
  }
  if (
    /executive plan|operational plan|recovery plan|staffing plan|initiative roadmap|workload balanc|bottleneck mitigat|campaign sequenc|governance schedul|escalation response plan|autonomous planning|generate plan/.test(
      p
    )
  ) {
    out.add("getExecutivePlanningOverview");
    out.add("generateExecutivePlan");
  }
  if (/generate.*plan|build.*roadmap|recovery strateg/.test(p)) {
    out.add("generateExecutivePlan");
  }
  if (
    /command center|live operational|incident intelligence|executive alert|kpi drift|escalation surge|governance anomal|campaign degrad|crisis coordin|operational crisis|command routing|approval surge|stalled fulfillment/.test(
      p
    )
  ) {
    out.add("getExecutiveCommandOverview");
    out.add("getExecutiveCommandIncidents");
    out.add("getExecutiveCommandAlerts");
  }
  if (/priority incident|incident triage/.test(p)) {
    out.add("getExecutiveCommandIncidents");
  }
  if (/executive alert|severity.?rank|alert priorit/.test(p)) {
    out.add("getExecutiveCommandAlerts");
  }
  if (/what.*client still need|what department|fulfillment-ready|depends on trust|depends on website|ai revenue os onboarding|operational bottleneck/.test(p)) {
    out.add("getClientFulfillmentOperations");
  }
  if (/knowledge|kb|docs/.test(p)) out.add("getKnowledgeBaseSummary");
  if (
    /\bneuro\b|source.?backed|uploaded source|what do our.*sources say|trust law source|our sources say|open the source|cited passage/.test(
      p
    )
  ) {
    out.add("getNeuroSourceAnswer");
  }
  if (/\btrust\b.*\b(trustee|trust law|sources)\b/.test(p)) out.add("getNeuroSourceAnswer");
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
  if (/site analytics|site traffic|how many visitors|active visitors|page views/.test(p)) {
    out.add("getPlatformAnalyticsSummary");
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
    if (agents.includes("reality")) out.add("getRealityActivityToday");
  }
  if (agents.some((a) => a.includes("jarva") || a.includes("trust"))) {
    out.add("getJarvaActivityToday");
  }

  if (out.size === 0) {
    out.add("getPlatformAnalyticsSummary");
    out.add("getPendingAccounts");
    out.add("getApprovedAccounts");
  }
  return [...out];
}
