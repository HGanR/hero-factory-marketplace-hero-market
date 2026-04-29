export type ClientHubStatus = "active" | "paused" | "churned" | string;

export type ClientHealthSnapshot = {
  /** 0–100 composite score (higher = healthier pipeline + engagement). */
  score: number;
  status: "thriving" | "healthy" | "steady" | "at_risk";
  /** Short label for badges and overview. */
  label: string;
  /** Human-readable gaps (max ~6). */
  issues: string[];
};

export type ClientListItem = {
  id: string;
  name: string;
  status: string;
  workspaceId: string | null;
  logoUrl: string | null;
  requestedServices: string[];
  siteCount: number;
  agentBindingCount: number;
  openConversations: number;
  leadsCount: number;
  campaignStatus: "none" | "active" | "unknown";
  lastActivityAt: string | null;
  updatedAt: string;
  /** Quick health (0–100) for list badges; full issues on client overview. */
  healthScore: number;
  healthLabel: string;
  healthStatus: ClientHealthSnapshot["status"];
};

/** Matches `client_accounts` row; used after ownership check. */
export type ClientAccountRow = {
  id: string;
  ownerUserId: number;
  name: string;
  workspaceId: string | null;
  status: string;
  notes: string | null;
  logoUrl: string | null;
  servicesJson: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ClientHubRollup = {
  leadsCaptured: number;
  conversationsOpened: number;
  openConversations: number;
  bookings: number;
  crmMessagesCount: number;
  widgetMessagesCount: number;
  messagesExchanged: number;
  /** Public embed / widget message rows (visitor ↔ agent) on this client’s sites. */
  agentInteractions: number;
  activeSites: number;
  activeAgents: number;
  campaignsLaunched: number;
  publishedPosts: number;
  websiteVisits: number | null;
  lastActivityAt: string | null;
  /** From `client_hub_automation_events` (same `userId` + `clientId` scope). */
  leadQualifiedCount: number;
  followUpCount: number;
  taskCreatedCount: number;
  bookingScheduledCount: number;
};

export type ClientSummary = {
  client: {
    id: string;
    name: string;
    status: string;
    workspaceId: string | null;
    notes: string | null;
    logoUrl: string | null;
    requestedServices: string[];
    createdAt: string;
    updatedAt: string;
  };
  metrics: {
    leadsCaptured: number;
    /** Total CRM conversation threads for this client. */
    conversations: number;
    conversationsOpened: number;
    openConversations: number;
    bookings: number;
    campaignsLaunched: number;
    websiteVisits: number | null;
    crmMessagesCount: number;
    widgetMessagesCount: number;
    messagesExchanged: number;
    publishedPosts: number;
    activeSites: number;
    activeAgents: number;
    /**
     * Widget (embed) message count — how often visitors exchanged messages with an agent
     * on a site bound to this client. CRM team replies live in `crmMessagesCount` / `messagesExchanged`.
     */
    agentInteractions: number;
    lastActivityAt: string | null;
    leadQualifiedCount: number;
    followUpCount: number;
    taskCreatedCount: number;
    bookingScheduledCount: number;
  };
  primarySite: {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    hasWidget: boolean;
  } | null;
  primaryAgent: { id: string; name: string; status: string | null; widgetKey: string | null } | null;
  recentConversations: Array<{
    id: string;
    subject: string | null;
    channel: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    contactEmail: string | null;
  }>;
  recentCampaignActivity: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  }>;
  nextBestAction: string;
  /** Optional second line (rationale) for the decision engine. */
  nextBestActionDetail?: string | null;
  health: ClientHealthSnapshot;
};

export type ClientSiteRow = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  hasWidget: boolean;
  widgetKey: string | null;
  boundAgentId: string | null;
  boundAgentName: string | null;
};

export type ClientAgentRow = {
  bindingId: string;
  agentId: string;
  agentName: string;
  agentStatus: string | null;
  siteId: string;
  siteName: string;
  widgetKey: string;
  hasKnowledge: boolean;
  toolsEnabled: boolean;
};

export type InboxRow = {
  conversation: {
    id: string;
    contactId: string | null;
    channel: string;
    status: string | null;
    subject: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    unreadCount: number;
  };
  contact: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    leadSource: string | null;
  } | null;
  /** Parsed from `crm_contacts.customFields` when present (widget/session attribution). */
  sourceSiteName: string | null;
  sourceAgentName: string | null;
};

export type ClientActivityItem = {
  id: string;
  kind:
    | "client"
    | "site"
    | "site_version"
    | "binding"
    | "contact"
    | "conversation"
    | "message"
    | "widget"
    | "campaign"
    | "post"
    | "platform_event"
    | "automation";
  title: string;
  detail: string | null;
  occurredAt: string;
};

export type ClientAnalyticsResponse = {
  version: 1;
  leadConversion: { value: number | null; label: string; isPlaceholder: boolean; activationHint: string | null };
  agentResponseVolume: { value: number | null; label: string; isPlaceholder: boolean; activationHint: string | null };
  campaignEngagement: { value: number | null; label: string; isPlaceholder: boolean; activationHint: string | null };
  bookingRate: { value: number | null; label: string; isPlaceholder: boolean; activationHint: string | null };
  websiteActivity: { value: number | null; label: string; isPlaceholder: boolean; activationHint: string | null };
  knownMetrics: {
    leadsCaptured: number;
    openConversations: number;
    conversations: number;
    crmMessageCount: number;
    widgetMessageCount: number;
    messagesExchanged: number;
    activeSites: number;
    activeAgents: number;
    campaignsLaunched: number;
    publishedPosts: number;
    lastActivityAt: string | null;
  };
};

export type ClientCampaignListItem = {
  id: string;
  name: string;
  platform: string;
  status: string;
  postsCount: number;
  postedCount: number;
  engagementHint: string | null;
  lastSyncAt: string | null;
  dataSource: "campaigns" | "adapter_unscoped_legacy";
  adapterNote: string | null;
};
