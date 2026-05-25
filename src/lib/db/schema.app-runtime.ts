import { boolean, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const aiAgents = mysqlTable("ai_agents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: varchar("workspaceId", { length: 64 }),
  consultantId: varchar("consultantId", { length: 36 }),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 255 }),
  systemPrompt: text("systemPrompt"),
  model: varchar("model", { length: 64 }),
  temperature: varchar("temperature", { length: 16 }),
  toolsJson: text("toolsJson"),
  voiceProvider: varchar("voiceProvider", { length: 32 }),
  voiceId: varchar("voiceId", { length: 64 }),
  llmEndpoint: varchar("llmEndpoint", { length: 512 }),
  llmApiKeyEnc: text("llmApiKeyEnc"),
  language: varchar("language", { length: 16 }),
  industriesJson: text("industriesJson"),
  avatarImageUrl: text("avatarImageUrl"),
  avatarAltText: varchar("avatarAltText", { length: 160 }),
  /** Discriminator for test/widget runtime persona (e.g. executive_admin for SKIPPER). */
  agentRuntimeType: varchar("agentRuntimeType", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiAgentSiteBindings = mysqlTable("ai_agent_site_bindings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  siteId: varchar("siteId", { length: 36 }).notNull(),
  clientId: varchar("clientId", { length: 36 }),
  isActive: boolean("isActive").notNull().default(true),
  widgetKey: varchar("widgetKey", { length: 48 }).notNull(),
  allowedDomains: text("allowedDomains"),
  metadata: json("metadata").$type<Record<string, unknown> | string | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiAgentCollaborators = mysqlTable("ai_agent_collaborators", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("accepted"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const web3Sites = mysqlTable("web3_sites", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 36 }),
  trustId: varchar("trustId", { length: 36 }),
  workspaceId: varchar("workspaceId", { length: 36 }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 191 }),
  status: varchar("status", { length: 16 }).notNull().default("DRAFT"),
  ownerWallet: varchar("ownerWallet", { length: 140 }),
  nftChainId: int("nftChainId"),
  nftContract: varchar("nftContract", { length: 140 }),
  nftTokenId: varchar("nftTokenId", { length: 120 }),
  currentVersionId: varchar("currentVersionId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const web3SiteVersions = mysqlTable("web3_site_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  siteId: varchar("siteId", { length: 36 }).notNull(),
  version: int("version").notNull(),
  schemaJson: text("schemaJson").notNull(),
  schemaHash: varchar("schemaHash", { length: 64 }).notNull(),
  buildManifestJson: text("buildManifestJson"),
  ipfsCid: varchar("ipfsCid", { length: 191 }),
  previewImageCid: varchar("previewImageCid", { length: 191 }),
  glbScenePlanId: varchar("glbScenePlanId", { length: 64 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdByWallet: varchar("createdByWallet", { length: 140 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const crm_contacts = mysqlTable("crm_contacts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 36 }),
  userId: int("userId"),
  clientId: varchar("clientId", { length: 36 }),
  email: varchar("email", { length: 320 }),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  leadSource: varchar("leadSource", { length: 100 }),
  tags: text("tags"),
  customFields: json("customFields").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const crm_conversations = mysqlTable("crm_conversations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  contactId: varchar("contactId", { length: 36 }),
  userId: int("userId"),
  workspaceId: varchar("workspaceId", { length: 36 }),
  channel: varchar("channel", { length: 32 }).notNull().default("sms"),
  status: varchar("status", { length: 50 }),
  subject: varchar("subject", { length: 255 }),
  lastMessageAt: timestamp("lastMessageAt"),
  lastMessagePreview: varchar("lastMessagePreview", { length: 255 }),
  unreadCount: int("unreadCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const crm_messages = mysqlTable("crm_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  conversationId: varchar("conversationId", { length: 36 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull().default("inbound"),
  channel: varchar("channel", { length: 32 }).notNull().default("sms"),
  content: text("content"),
  subject: varchar("subject", { length: 255 }),
  callLogId: varchar("callLogId", { length: 36 }),
  status: varchar("status", { length: 32 }),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const widgetConversations = mysqlTable("widget_conversations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  widgetBindingId: varchar("widget_binding_id", { length: 36 }).notNull(),
  widgetKeySnapshot: varchar("widget_key_snapshot", { length: 48 }).notNull(),
  siteId: varchar("site_id", { length: 36 }),
  siteVersionId: varchar("site_version_id", { length: 36 }),
  agentId: varchar("agent_id", { length: 36 }),
  ownerUserId: int("owner_user_id"),
  publicConversationId: varchar("public_conversation_id", { length: 48 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  originHost: varchar("origin_host", { length: 255 }),
  visitorId: varchar("visitor_id", { length: 64 }),
  sessionId: varchar("session_id", { length: 128 }),
  providerStrategySnapshot: varchar("provider_strategy_snapshot", { length: 32 }),
  metadataJson: json("metadata_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const widgetMessages = mysqlTable("widget_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  contentText: text("content_text").notNull(),
  providerStrategySnapshot: varchar("provider_strategy_snapshot", { length: 32 }),
  modelSnapshot: varchar("model_snapshot", { length: 128 }),
  tokenUsageJson: json("token_usage_json").$type<Record<string, unknown> | null>(),
  latencyMs: int("latency_ms"),
  status: varchar("status", { length: 16 }).notNull().default("ok"),
  errorCode: varchar("error_code", { length: 64 }),
  metadataJson: json("metadata_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Agent plugin / widget turn memory (`agents-ensure.ts`). */
export const agentConversationSessions = mysqlTable("agent_conversation_sessions", {
  sessionKey: varchar("sessionKey", { length: 128 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  turnsJson: text("turnsJson").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** See `drizzle/0011_add_developer_platform_tables.sql`. */
export const developerApiKeys = mysqlTable("developer_api_keys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  scopes: text("scopes"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const developerWebhooks = mysqlTable("developer_webhooks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  events: text("events").notNull(),
  secret: varchar("secret", { length: 128 }),
  isActive: boolean("isActive").notNull().default(true),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatus: int("lastStatus"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workflowAutomations = mysqlTable("workflow_automations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  triggerEvent: varchar("triggerEvent", { length: 100 }).notNull(),
  triggerFilter: json("triggerFilter").$type<Record<string, unknown> | null>(),
  actions: json("actions").$type<Record<string, unknown> | string | null>(),
  isActive: boolean("isActive").notNull().default(true),
  lastRunAt: timestamp("lastRunAt"),
  runCount: int("runCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const platformActivity = mysqlTable("platform_activity", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  sourceModule: varchar("sourceModule", { length: 80 }).notNull(),
  payload: json("payload").$type<Record<string, unknown> | null>(),
  trustId: varchar("trustId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustDebtInstruments = mysqlTable("trust_debt_instruments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  instrumentType: varchar("instrumentType", { length: 32 }),
  exemption: varchar("exemption", { length: 32 }),
  bondNumber: varchar("bondNumber", { length: 64 }),
  principalAmount: varchar("principalAmount", { length: 64 }),
  interestRate: varchar("interestRate", { length: 32 }),
  interestType: varchar("interestType", { length: 24 }),
  paymentFrequencyMonths: int("paymentFrequencyMonths"),
  maturityDate: varchar("maturityDate", { length: 32 }),
  seniority: varchar("seniority", { length: 24 }),
  callable: boolean("callable").notNull().default(false),
  governingLaw: varchar("governingLaw", { length: 100 }),
  ppmDocumentId: varchar("ppmDocumentId", { length: 36 }),
  isNonRecourse: boolean("isNonRecourse").notNull().default(false),
  revenueSourceDescription: text("revenueSourceDescription"),
  trusteeResolutionId: varchar("trusteeResolutionId", { length: 36 }),
  bondInstrumentDocumentId: varchar("bondInstrumentDocumentId", { length: 36 }),
  trusteeName: varchar("trusteeName", { length: 200 }),
  trustName: varchar("trustName", { length: 200 }),
  trustDateLabel: varchar("trustDateLabel", { length: 80 }),
  advertisingAllowed: boolean("advertisingAllowed").notNull().default(false),
  accreditedOnly: boolean("accreditedOnly").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiAgentKnowledgeItems = mysqlTable("ai_agent_knowledge_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  contentOrPointer: text("contentOrPointer").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentPluginInstallations = mysqlTable("agent_plugin_installations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  pluginKey: varchar("pluginKey", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentPluginCredentials = mysqlTable("agent_plugin_credentials", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  refreshTokenEnc: text("refreshTokenEnc"),
  accessTokenEnc: text("accessTokenEnc"),
  expiresAt: timestamp("expiresAt"),
  scopesJson: text("scopesJson"),
  lastError: varchar("lastError", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
