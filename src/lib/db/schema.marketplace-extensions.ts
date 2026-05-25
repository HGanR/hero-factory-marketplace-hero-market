// Auto-generated baseline — align columns with drizzle/*.sql when migrations drift.
import {
  boolean,
  date,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const agentActions = mysqlTable("agent_actions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  proposalJson: json("proposalJson").notNull(),
  appliedPatchJson: json("appliedPatchJson"),
  acceptedByUserId: int("acceptedByUserId"),
  bindingKey: varchar("bindingKey", { length: 80 }),
  bindingPath: varchar("bindingPath", { length: 200 }),
  schemaVersion: varchar("schemaVersion", { length: 20 }),
  beforeHash: varchar("beforeHash", { length: 64 }),
  afterHash: varchar("afterHash", { length: 64 }),
  patchHash: varchar("patchHash", { length: 64 }),
  noOp: boolean("noOp").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const agentSessions = mysqlTable("agent_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }),
  moduleType: varchar("moduleType", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["active", "closed"]).notNull().default("active"),
  createdByUserId: int("createdByUserId").notNull(),
  messages: json("messages").$type<unknown[]>().$defaultFn(() => []),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentConversationSessions = mysqlTable("agent_conversation_sessions", {
  sessionKey: varchar("sessionKey", { length: 128 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  turnsJson: text("turnsJson").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentToolCallAudit = mysqlTable("agent_tool_call_audit", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  actionKey: varchar("actionKey", { length: 64 }).notNull(),
  inputSummary: text("inputSummary").notNull(),
  success: boolean("success").notNull().default(false),
  errorCode: varchar("errorCode", { length: 64 }),
  successDescriptor: varchar("successDescriptor", { length: 255 }),
  latencyMs: int("latencyMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const agentToolFingerprint = mysqlTable("agent_tool_fingerprint", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull(),
  actionKey: varchar("actionKey", { length: 64 }).notNull(),
  inputHash: varchar("inputHash", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const agentArchitectureMaps = mysqlTable("agent_architecture_maps", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
  consultantId: varchar("consultantId", { length: 36 }),
  title: varchar("title", { length: 255 }).notNull(),
  nodesJson: text("nodesJson").notNull(),
  edgesJson: text("edgesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiAgentBuildingBindings = mysqlTable("ai_agent_building_bindings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  buildingId: varchar("buildingId", { length: 64 }).notNull(),
  apiKey: varchar("apiKey", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiVoices = mysqlTable("ai_voices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerVoiceId: varchar("providerVoiceId", { length: 64 }).notNull(),
  isCustom: boolean("isCustom").notNull().default(true),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  consent: json("consent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const approvals = mysqlTable("approvals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  targetType: mysqlEnum("targetType", ["minutes", "resolution"]).notNull(),
  targetId: varchar("targetId", { length: 36 }).notNull(),
  requiredRole: mysqlEnum("requiredRole", [
    "Trustee",
    "Manager",
    "Director",
    "Officer",
    "Member",
    "LeadTrustee",
    "ManagingMember",
    "Chair",
    "Secretary",
  ]).notNull(),
  approverId: int("approverId"),
  approverName: varchar("approverName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  approvedAt: timestamp("approvedAt"),
  signatureHash: varchar("signatureHash", { length: 64 }),
});

export const authNonces = mysqlTable("auth_nonces", {
  walletAddress: varchar("walletAddress", { length: 42 }).primaryKey(),
  nonce: varchar("nonce", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const avatarProfiles = mysqlTable("avatar_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 120 }),
  avatarModelUrl: varchar("avatarModelUrl", { length: 512 }).notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 512 }),
  configJson: text("configJson"),
  sourceType: mysqlEnum("sourceType", ["preset", "uploaded", "generated"]).notNull().default("preset"),
  version: int("version").notNull().default(1),
  isDefault: boolean("isDefault").notNull().default(false),
  status: mysqlEnum("status", ["draft", "ready"]).notNull().default("ready"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bentleyExplainabilitySnapshots = mysqlTable("bentley_explainability_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }),
  trustId: varchar("trust_id", { length: 36 }),
  snapshotType: varchar("snapshot_type", { length: 48 }).notNull().default("decision_explanation"),
  inputJson: json("input_json"),
  outputJson: json("output_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const capitalPlans = mysqlTable("capital_plans", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  profileId: varchar("profile_id", { length: 36 }),
  snapshotMonth: varchar("snapshot_month", { length: 7 }),
  adSpend: decimal("ad_spend", { precision: 18, scale: 2 }).notNull(),
  channelMix: json("channel_mix"),
  cac: decimal("cac", { precision: 18, scale: 2 }).notNull(),
  ltv: decimal("ltv", { precision: 18, scale: 2 }).notNull(),
  margins: decimal("margins", { precision: 5, scale: 4 }),
  payload: json("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const channelSpendSnapshots = mysqlTable("channel_spend_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  profileId: varchar("profile_id", { length: 36 }),
  month: varchar("month", { length: 7 }).notNull(),
  channel: varchar("channel", { length: 64 }).notNull(),
  spend: decimal("spend", { precision: 18, scale: 2 }).notNull(),
  revenueAttributed: decimal("revenue_attributed", { precision: 18, scale: 2 }),
  roas: decimal("roas", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clusterSymbols = mysqlTable("cluster_symbols", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clusterId: varchar("clusterId", { length: 36 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export const companies = mysqlTable("companies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  formationState: varchar("formationState", { length: 2 }).notNull(),
  companyKind: mysqlEnum("companyKind", ["parent_holding_company", "operating_company"]).notNull(),
  corpType: mysqlEnum("corpType", ["c_corp", "s_corp", "llc", "unknown"]).notNull(),
  parentStructure: mysqlEnum("parentStructure", [
    "single_parent_single_sub",
    "single_parent_multi_sub",
    "parent_only",
    "unknown",
  ]).notNull(),
  registeredAgentPlanned: boolean("registeredAgentPlanned").default(false),
  authorizedShares: int("authorizedShares"),
  parValue: decimal("parValue", { precision: 10, scale: 6 }),
  fiscalYearEndMonth: int("fiscalYearEndMonth"),
  boardSize: int("boardSize"),
  officersPlanned: boolean("officersPlanned").default(true),
  initialBoardConsentPlanned: boolean("initialBoardConsentPlanned").default(true),
  publicCompanyId: varchar("publicCompanyId", { length: 20 }),
  status: mysqlEnum("status", ["draft", "counsel_reviewed", "board_adopted", "execution_ready"])
    .notNull()
    .default("draft"),
  draftJson: text("draftJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const companyAffiliations = mysqlTable("company_affiliations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  affiliationType: mysqlEnum("affiliationType", [
    "parent_subsidiary",
    "company_trust",
    "company_family_office",
    "company_foundation",
    "company_dao",
  ]).notNull(),
  parentCompanyId: varchar("parentCompanyId", { length: 36 }).notNull(),
  subsidiaryCompanyId: varchar("subsidiaryCompanyId", { length: 36 }),
  trustId: varchar("trustId", { length: 36 }),
  familyOfficeId: varchar("familyOfficeId", { length: 36 }),
  foundationId: varchar("foundationId", { length: 36 }),
  subsidiaryKind: mysqlEnum("subsidiaryKind", ["operating", "ip_holdco", "real_estate", "other"]),
  ownershipPercentage: int("ownershipPercentage"),
  notes: text("notes"),
  relationshipRole: varchar("relationshipRole", { length: 100 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const companySequences = mysqlTable("company_sequences", {
  id: varchar("id", { length: 36 }).primaryKey(),
  scope: varchar("scope", { length: 191 }).notNull(),
  currentValue: int("currentValue").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const consultantNotes = mysqlTable("consultant_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  consultantId: varchar("consultantId", { length: 36 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  timeframe: varchar("timeframe", { length: 5 }).notNull(),
  notes: text("notes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const consultantWatchlists = mysqlTable("consultant_watchlists", {
  id: varchar("id", { length: 36 }).primaryKey(),
  consultantId: varchar("consultantId", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const crm_call_logs = mysqlTable("crm_call_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  conversationId: varchar("conversationId", { length: 36 }),
  contactId: varchar("contactId", { length: 36 }),
  userId: int("userId"),
  voiceAgentId: varchar("voiceAgentId", { length: 36 }),
  fromNumber: varchar("fromNumber", { length: 50 }).notNull(),
  toNumber: varchar("toNumber", { length: 50 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull(),
  status: varchar("status", { length: 50 }),
  duration: int("duration"),
  recordingUrl: text("recordingUrl"),
  transcript: text("transcript"),
  twilioCallSid: varchar("twilioCallSid", { length: 100 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const crm_tasks = mysqlTable("crm_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  contactId: varchar("contactId", { length: 36 }),
  userId: int("userId"),
  workspaceId: varchar("workspaceId", { length: 36 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueAt: timestamp("dueAt"),
  status: varchar("status", { length: 32 }),
  priority: varchar("priority", { length: 32 }),
  source: varchar("source", { length: 32 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const deeds = mysqlTable("deeds", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  trustId: varchar("trustId", { length: 36 }),
  entityId: varchar("entityId", { length: 36 }),
  deedType: mysqlEnum("deedType", [
    "QUITCLAIM",
    "WARRANTY_GENERAL",
    "WARRANTY_SPECIAL",
    "GRANT",
    "TRUST_TRANSFER",
    "OTHER",
  ]).notNull(),
  status: mysqlEnum("status", ["draft", "pending", "approved", "executed", "recorded", "void"]).notNull().default("draft"),
  approvingResolutionId: varchar("approvingResolutionId", { length: 36 }),
  approvingMinutesId: varchar("approvingMinutesId", { length: 36 }),
  propertyId: varchar("propertyId", { length: 36 }),
  executionId: varchar("executionId", { length: 36 }),
  recordingId: varchar("recordingId", { length: 36 }),
  draftPdfExhibitId: varchar("draftPdfExhibitId", { length: 36 }),
  executedPdfExhibitId: varchar("executedPdfExhibitId", { length: 36 }),
  finalHash: varchar("finalHash", { length: 64 }),
  lockedAt: timestamp("lockedAt"),
  instrumentId: varchar("instrumentId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deedProperties = mysqlTable("deed_properties", {
  id: varchar("id", { length: 36 }).primaryKey(),
  street1: varchar("street1", { length: 255 }),
  street2: varchar("street2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postalCode", { length: 20 }),
  county: varchar("county", { length: 100 }),
  parcelNumber: varchar("parcelNumber", { length: 100 }),
  legalDescription: text("legalDescription"),
  situsJurisdiction: varchar("situsJurisdiction", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deedParties = mysqlTable("deed_parties", {
  id: varchar("id", { length: 36 }).primaryKey(),
  deedId: varchar("deedId", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["GRANTOR", "GRANTEE", "PREPARER", "NOTARY", "WITNESS"]).notNull(),
  personId: varchar("personId", { length: 36 }),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  capacityLine: varchar("capacityLine", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
});

export const deedExecutions = mysqlTable("deed_executions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  method: mysqlEnum("method", ["WET_IN_PERSON", "ESIGN", "RON"]).notNull().default("WET_IN_PERSON"),
  signDate: timestamp("signDate"),
  notarized: boolean("notarized").notNull().default(false),
  witnessesRequired: boolean("witnessesRequired").notNull().default(false),
  witnessesCount: int("witnessesCount").notNull().default(0),
  notaryName: varchar("notaryName", { length: 255 }),
  notaryCommission: varchar("notaryCommission", { length: 100 }),
  notaryState: varchar("notaryState", { length: 50 }),
  acknowledgementText: text("acknowledgementText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deedRecordings = mysqlTable("deed_recordings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  status: mysqlEnum("status", ["NOT_SUBMITTED", "SUBMITTED", "RECORDED", "REJECTED"]).notNull().default("NOT_SUBMITTED"),
  county: varchar("county", { length: 100 }),
  state: varchar("state", { length: 50 }),
  submittedAt: timestamp("submittedAt"),
  recordedAt: timestamp("recordedAt"),
  instrumentNumber: varchar("instrumentNumber", { length: 100 }),
  book: varchar("book", { length: 50 }),
  page: varchar("page", { length: 50 }),
  rejectionReason: text("rejectionReason"),
  recordingReceiptExhibitId: varchar("recordingReceiptExhibitId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const exhibits = mysqlTable("exhibits", {
  id: varchar("id", { length: 36 }).primaryKey(),
  minutesId: varchar("minutesId", { length: 36 }),
  resolutionId: varchar("resolutionId", { length: 36 }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 100 }).notNull(),
  storagePath: varchar("storagePath", { length: 500 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export const minuteBooks = mysqlTable("minute_books", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  entityId: varchar("entityId", { length: 36 }),
  trustId: varchar("trustId", { length: 36 }),
  entityType: mysqlEnum("entityType", ["Trust", "LLC", "C-Corp", "Foundation", "Partnership", "Other"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  retentionPolicy: varchar("retentionPolicy", { length: 100 }),
});

export const minuteParticipants = mysqlTable("minute_participants", {
  id: varchar("id", { length: 36 }).primaryKey(),
  minutesId: varchar("minutesId", { length: 36 }).notNull(),
  personId: varchar("personId", { length: 36 }),
  personName: varchar("personName", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["Trustee", "Manager", "Director", "Officer", "Member", "Consultant", "Other"]).notNull(),
  present: boolean("present").notNull().default(true),
  votingPower: decimal("votingPower", { precision: 10, scale: 2 }).notNull().default("1.00"),
});

export const resolutionVotes = mysqlTable("resolution_votes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  resolutionId: varchar("resolutionId", { length: 36 }).notNull(),
  personId: varchar("personId", { length: 36 }).notNull(),
  personName: varchar("personName", { length: 255 }).notNull(),
  vote: mysqlEnum("vote", ["for", "against", "abstain"]).notNull(),
  votedAt: timestamp("votedAt").defaultNow().notNull(),
});

export const entityMaps = mysqlTable("entity_maps", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  nodesJson: text("nodesJson").notNull(),
  edgesJson: text("edgesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const exchangeTransactions = mysqlTable("exchange_transactions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userAddress: varchar("userAddress", { length: 255 }).notNull(),
  fromCurrency: varchar("fromCurrency", { length: 50 }).notNull(),
  toCurrency: varchar("toCurrency", { length: 50 }).notNull(),
  fromAmount: decimal("fromAmount", { precision: 20, scale: 8 }).notNull(),
  toAmount: decimal("toAmount", { precision: 20, scale: 8 }).notNull(),
  exchangeRate: decimal("exchangeRate", { precision: 20, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 20, scale: 8 }).default("0.00"),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending"),
  transactionId: varchar("transactionId", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const estateInstruments = mysqlTable("estate_instruments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull(),
  type: mysqlEnum("type", ["WILL", "TESTAMENTARY_TRUST"]).notNull(),
  status: mysqlEnum("status", ["DRAFT", "FINAL", "REVOKED"]).notNull().default("DRAFT"),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 36 }),
  entityId: varchar("entityId", { length: 36 }),
  trustId: varchar("trustId", { length: 36 }),
  title: varchar("title", { length: 255 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const estateInstrumentVersions = mysqlTable("estate_instrument_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  instrumentId: varchar("instrumentId", { length: 36 }).notNull(),
  version: int("version").notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const filingOrders = mysqlTable("filing_orders", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  entityId: int("entityId"),
  orderType: mysqlEnum("orderType", ["FOREIGN_OWNED_SMLLC_5472", "PARTNERSHIP_1065"]).notNull(),
  taxYear: int("taxYear").notNull(),
  priceCents: int("priceCents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  status: mysqlEnum("status", [
    "DRAFT",
    "PAYMENT_PENDING",
    "INTAKE_IN_PROGRESS",
    "READY_FOR_AGENT",
    "IN_REVIEW",
    "NEEDS_INFO",
    "SUBMITTED",
    "COMPLETED",
    "CANCELED",
  ])
    .notNull()
    .default("DRAFT"),
  dueDate: timestamp("dueDate"),
  extensionDate: timestamp("extensionDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const filingPackets = mysqlTable("filing_packets", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  version: int("version").notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const instruments = mysqlTable("instruments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }),
  entityId: varchar("entityId", { length: 36 }),
  instrumentType: mysqlEnum("instrumentType", ["DEED", "RESOLUTION", "LIEN", "ASSIGNMENT", "AWARD", "FEE_SCHEDULE"]).notNull(),
  status: mysqlEnum("status", ["draft", "authorized", "executed", "recorded", "witnessed", "settled"])
    .notNull()
    .default("draft"),
  authorityResolutionId: varchar("authorityResolutionId", { length: 36 }),
  concreteId: varchar("concreteId", { length: 36 }).notNull(),
  concreteType: varchar("concreteType", { length: 50 }).notNull(),
  instrumentHash: varchar("instrumentHash", { length: 64 }).notNull(),
  executedAt: timestamp("executedAt"),
  recordedAt: timestamp("recordedAt"),
  witnessedAt: timestamp("witnessedAt"),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const publicWitnesses = mysqlTable("public_witnesses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  instrumentId: varchar("instrumentId", { length: 36 }).notNull(),
  network: mysqlEnum("network", ["ethereum", "polygon", "besu", "other"]).notNull(),
  txHash: varchar("txHash", { length: 191 }).notNull(),
  blockNumber: int("blockNumber"),
  witnessHash: varchar("witnessHash", { length: 64 }).notNull(),
  notarizedAt: timestamp("notarizedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const offers = mysqlTable("offers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  priceRange: varchar("priceRange", { length: 64 }),
  promise: text("promise"),
  icp: text("icp"),
  deliverables: text("deliverables"),
  guarantee: text("guarantee"),
  riskReversal: text("riskReversal"),
  positioning: text("positioning"),
  proof: text("proof"),
  objections: text("objections"),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const offerAssets = mysqlTable("offer_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  offerId: varchar("offerId", { length: 36 }).notNull(),
  vslScript: text("vslScript"),
  landingCopy: text("landingCopy"),
  adAngles: text("adAngles"),
  emailSeq: text("emailSeq"),
  callScript: text("callScript"),
  version: int("version").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const grantApplications = mysqlTable("grant_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  walletAddress: varchar("walletAddress", { length: 42 }),
  title: varchar("title", { length: 255 }).notNull(),
  funderName: varchar("funderName", { length: 255 }),
  deadline: date("deadline"),
  amountRequested: varchar("amountRequested", { length: 64 }),
  status: mysqlEnum("status", ["draft", "submitted", "awarded", "declined"]).notNull().default("draft"),
  legalStatus: text("legalStatus"),
  taxId: varchar("taxId", { length: 64 }),
  governingDocs: text("governingDocs"),
  complianceCerts: text("complianceCerts"),
  insuranceCoverage: text("insuranceCoverage"),
  orgLegalName: varchar("orgLegalName", { length: 255 }),
  orgContactInfo: text("orgContactInfo"),
  orgEntityType: varchar("orgEntityType", { length: 100 }),
  missionStatement: text("missionStatement"),
  visionStatement: text("visionStatement"),
  geographicAreas: text("geographicAreas"),
  projectSummary: text("projectSummary"),
  primaryGoals: text("primaryGoals"),
  specificFundingNeeds: text("specificFundingNeeds"),
  needsStatement: text("needsStatement"),
  supportingEvidence: text("supportingEvidence"),
  currentEfforts: text("currentEfforts"),
  stakeholders: text("stakeholders"),
  alignmentStatement: text("alignmentStatement"),
  alignmentSupportingDocs: text("alignmentSupportingDocs"),
  staffExpertise: text("staffExpertise"),
  pastSuccesses: text("pastSuccesses"),
  financialStability: text("financialStability"),
  resources: text("resources"),
  partnerships: text("partnerships"),
  sustainabilityPlan: text("sustainabilityPlan"),
  longTermImpact: text("longTermImpact"),
  replicationScalability: text("replicationScalability"),
  narrative: text("narrative"),
  budget: text("budget"),
  matchingFunds: text("matchingFunds"),
  fundingSources: text("fundingSources"),
  costJustification: text("costJustification"),
  evaluationMetrics: text("evaluationMetrics"),
  monitoringPlan: text("monitoringPlan"),
  dataCollectionMethods: text("dataCollectionMethods"),
  reportingSchedule: text("reportingSchedule"),
  projectLeader: text("projectLeader"),
  financialContact: text("financialContact"),
  authorizedSignatories: text("authorizedSignatories"),
  goals: text("goals"),
  methodology: text("methodology"),
  timeline: text("timeline"),
  otherRelevantDocs: text("otherRelevantDocs"),
  flexibilityModifications: text("flexibilityModifications"),
  referralSources: text("referralSources"),
  ethicalAcknowledgment: boolean("ethicalAcknowledgment").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const generatedDocuments = mysqlTable("generated_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const industryBenchmarks = mysqlTable("industry_benchmarks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  industry: varchar("industry", { length: 120 }).notNull(),
  metric: varchar("metric", { length: 120 }).notNull(),
  value: decimal("value", { precision: 18, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  sourceName: varchar("source_name", { length: 160 }).notNull(),
  citationUrl: varchar("citation_url", { length: 500 }).notNull(),
  year: int("year").notNull(),
  confidence: varchar("confidence", { length: 24 }),
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketClusters = mysqlTable("market_clusters", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marketScans = mysqlTable("market_scans", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  industry: varchar("industry", { length: 120 }).notNull(),
  geo: varchar("geo", { length: 120 }),
  offerType: varchar("offer_type", { length: 120 }),
  payload: json("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modelPlans = mysqlTable("model_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trustId: varchar("trustId", { length: 36 }),
  name: varchar("name", { length: 255 }).notNull(),
  planKind: varchar("planKind", { length: 32 }).notNull(),
  planVersion: int("planVersion").notNull(),
  planJson: text("planJson").notNull(),
  planHash: varchar("planHash", { length: 64 }),
  prompt: text("prompt"),
  seed: int("seed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const nftActivity = mysqlTable("nft_activity", {
  id: varchar("id", { length: 36 }).primaryKey(),
  nftId: varchar("nftId", { length: 36 }).notNull(),
  activityType: mysqlEnum("activityType", ["mint", "list", "sale", "transfer", "cancel"]).notNull(),
  fromAddress: varchar("fromAddress", { length: 255 }),
  toAddress: varchar("toAddress", { length: 255 }),
  price: decimal("price", { precision: 20, scale: 8 }),
  currency: varchar("currency", { length: 10 }),
  txHash: varchar("txHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const nftCollections = mysqlTable("nft_collections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  chain: mysqlEnum("chain", ["xrpl", "solana", "ethereum", "polygon", "metallicus"]).notNull(),
  contractAddress: varchar("contractAddress", { length: 255 }),
  creatorAddress: varchar("creatorAddress", { length: 255 }).notNull(),
  royaltyPercentage: decimal("royaltyPercentage", { precision: 5, scale: 2 }).notNull().default("0"),
  isPublic: boolean("isPublic").notNull().default(false),
  isVerified: boolean("isVerified").notNull().default(false),
  totalSupply: int("totalSupply").notNull().default(0),
  floorPrice: decimal("floorPrice", { precision: 20, scale: 8 }),
  volumeTraded: decimal("volumeTraded", { precision: 30, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const nftListings = mysqlTable("nft_listings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  nftId: varchar("nftId", { length: 36 }).notNull(),
  sellerAddress: varchar("sellerAddress", { length: 255 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  listingType: mysqlEnum("listingType", ["fixed", "auction"]).notNull().default("fixed"),
  auctionEndTime: timestamp("auctionEndTime"),
  highestBid: decimal("highestBid", { precision: 20, scale: 8 }),
  highestBidder: varchar("highestBidder", { length: 255 }),
  status: mysqlEnum("status", ["active", "sold", "cancelled", "expired"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  soldAt: timestamp("soldAt"),
});

export const nftSales = mysqlTable("nft_sales", {
  id: varchar("id", { length: 36 }).primaryKey(),
  nftId: varchar("nftId", { length: 36 }).notNull(),
  listingId: varchar("listingId", { length: 36 }),
  sellerAddress: varchar("sellerAddress", { length: 255 }).notNull(),
  buyerAddress: varchar("buyerAddress", { length: 255 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  royaltyAmount: decimal("royaltyAmount", { precision: 20, scale: 8 }).notNull().default("0"),
  platformFee: decimal("platformFee", { precision: 20, scale: 8 }).notNull().default("0"),
  txHash: varchar("txHash", { length: 255 }),
  soldAt: timestamp("soldAt").defaultNow().notNull(),
});

export const nfts = mysqlTable("nfts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tokenId: varchar("tokenId", { length: 255 }).notNull(),
  chain: mysqlEnum("chain", ["xrpl", "solana", "ethereum", "polygon", "metallicus"]).notNull(),
  contractAddress: varchar("contractAddress", { length: 255 }),
  ownerAddress: varchar("ownerAddress", { length: 255 }).notNull(),
  creatorAddress: varchar("creatorAddress", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl").notNull(),
  metadataUrl: text("metadataUrl"),
  attributes: text("attributes"),
  collectionId: varchar("collectionId", { length: 36 }),
  isListed: boolean("isListed").notNull().default(false),
  listPrice: decimal("listPrice", { precision: 20, scale: 8 }),
  listCurrency: varchar("listCurrency", { length: 10 }),
  royaltyPercentage: decimal("royaltyPercentage", { precision: 5, scale: 2 }).notNull().default("0"),
  isStaked: boolean("isStaked").notNull().default(false),
  mintedAt: timestamp("mintedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisEvents = mysqlTable("oasis_events", {
  id: varchar("id", { length: 80 }).primaryKey(),
  spaceId: varchar("spaceId", { length: 80 }).notNull(),
  type: mysqlEnum("type", ["SPACE_ACTIVATED"]).notNull(),
  actorWallet: varchar("actorWallet", { length: 140 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oasisMarketLicenses = mysqlTable("oasis_market_licenses", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  itemType: mysqlEnum("itemType", ["world", "object", "pack"]).notNull(),
  itemRefId: varchar("itemRefId", { length: 64 }).notNull(),
  purchaseId: varchar("purchaseId", { length: 64 }),
  status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisMarketPurchases = mysqlTable("oasis_market_purchases", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  itemType: mysqlEnum("itemType", ["world", "object", "pack"]).notNull(),
  itemRefId: varchar("itemRefId", { length: 64 }).notNull(),
  listingId: varchar("listingId", { length: 64 }),
  txHash: varchar("txHash", { length: 140 }),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull().default("0"),
  currency: mysqlEnum("currency", ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"])
    .notNull()
    .default("TROO"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oasisPlacements = mysqlTable("oasis_placements", {
  id: varchar("id", { length: 80 }).primaryKey(),
  spaceId: varchar("spaceId", { length: 80 }).notNull(),
  kind: varchar("kind", { length: 20 }),
  elementId: int("elementId"),
  elementKey: varchar("elementKey", { length: 120 }),
  name: varchar("name", { length: 255 }),
  modelUrl: text("modelUrl"),
  metadata: json("metadata"),
  x: decimal("x", { precision: 12, scale: 4 }).notNull(),
  y: decimal("y", { precision: 12, scale: 4 }).notNull(),
  z: decimal("z", { precision: 12, scale: 4 }).notNull(),
  ry: decimal("ry", { precision: 12, scale: 4 }).notNull(),
  scale: decimal("scale", { precision: 12, scale: 4 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisSpaces = mysqlTable("oasis_spaces", {
  id: varchar("id", { length: 80 }).primaryKey(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE"]).notNull().default("DRAFT"),
  activatedAt: timestamp("activatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const offerPackages = mysqlTable("offer_packages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  profileId: varchar("profile_id", { length: 36 }),
  name: varchar("name", { length: 200 }).notNull().default("Revenue ladder"),
  industryKey: varchar("industry_key", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const offerVersions = mysqlTable("offer_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  packageId: varchar("package_id", { length: 36 }).notNull(),
  version: int("version").notNull(),
  offerLadder: json("offer_ladder").notNull(),
  pricingBands: json("pricing_bands").notNull(),
  upsells: json("upsells").notNull(),
  targetMonthlyRevenue: decimal("target_monthly_revenue", { precision: 18, scale: 2 }),
  marginPct: decimal("margin_pct", { precision: 7, scale: 4 }),
  rawPayload: json("raw_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentVariants = mysqlTable("experiment_variants", {
  id: varchar("id", { length: 36 }).primaryKey(),
  experimentId: varchar("experiment_id", { length: 36 }).notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  isControl: boolean("is_control").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentResults = mysqlTable("experiment_results", {
  id: varchar("id", { length: 36 }).primaryKey(),
  experimentId: varchar("experiment_id", { length: 36 }).notNull(),
  variantId: varchar("variant_id", { length: 36 }).notNull(),
  metrics: json("metrics").notNull(),
  revenueLiftPct: decimal("revenue_lift_pct", { precision: 10, scale: 4 }),
  isWinner: boolean("is_winner").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsApplications = mysqlTable("revenue_os_applications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  clientId: varchar("client_id", { length: 36 }),
  trustId: varchar("trust_id", { length: 36 }),
  walletAddress: varchar("walletAddress", { length: 64 }),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 190 }).notNull(),
  businessSummary: text("businessSummary").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("SUBMITTED"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsExperiments = mysqlTable("revenue_os_experiments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  name: varchar("name", { length: 200 }).notNull(),
  lever: varchar("lever", { length: 32 }).notNull(),
  hypothesis: text("hypothesis"),
  status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
  inputSnapshot: json("input_snapshot"),
  resultSnapshot: json("result_snapshot"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsMonthlySnapshots = mysqlTable("revenue_os_monthly_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  month: varchar("month", { length: 7 }).notNull(),
  traffic: int("traffic").notNull(),
  conversionRatePct: decimal("conversion_rate_pct", { precision: 6, scale: 3 }).notNull(),
  avgOrderValue: decimal("avg_order_value", { precision: 18, scale: 2 }).notNull(),
  revenue: decimal("revenue", { precision: 18, scale: 2 }).notNull(),
  cac: decimal("cac", { precision: 18, scale: 2 }).notNull(),
  ltv: decimal("ltv", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsScenarios = mysqlTable("revenue_os_scenarios", {
  id: varchar("id", { length: 36 }).primaryKey(),
  payload: json("payload").notNull(),
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsFunnels = mysqlTable("revenue_os_funnels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  name: varchar("name", { length: 200 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsFunnelPages = mysqlTable("revenue_os_funnel_pages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  funnelId: varchar("funnel_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  sections: json("sections"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsMessageSequences = mysqlTable("revenue_os_message_sequences", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  profileId: varchar("profile_id", { length: 36 }),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  channel: varchar("channel", { length: 24 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsSequenceSteps = mysqlTable("revenue_os_sequence_steps", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sequenceId: varchar("sequence_id", { length: 36 }).notNull(),
  dayOffset: int("day_offset").notNull(),
  subject: varchar("subject", { length: 500 }),
  body: text("body").notNull(),
  trigger: varchar("trigger", { length: 120 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsFunnelDeploymentRuns = mysqlTable("revenue_os_funnel_deployment_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  funnelId: varchar("funnel_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  provider: varchar("provider", { length: 32 }).notNull().default("artifact"),
  mode: varchar("mode", { length: 32 }).notNull().default("stored"),
  status: varchar("status", { length: 24 }).notNull(),
  resultSummary: json("result_summary"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at").defaultNow().notNull(),
});

export const revenueOsSequenceExecutionRuns = mysqlTable("revenue_os_sequence_execution_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sequenceId: varchar("sequence_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  provider: varchar("provider", { length: 32 }).notNull().default("none"),
  mode: varchar("mode", { length: 32 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  resultSummary: json("result_summary"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at").defaultNow().notNull(),
});

export const specialistAppointments = mysqlTable("specialist_appointments", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: varchar("appointmentId", { length: 64 }).notNull(),
  visitorName: varchar("visitorName", { length: 200 }).notNull(),
  visitorEmail: varchar("visitorEmail", { length: 255 }).notNull(),
  visitorPhone: varchar("visitorPhone", { length: 50 }),
  appointmentDate: timestamp("appointmentDate").notNull(),
  appointmentType: mysqlEnum("appointmentType", [
    "trust_consultation",
    "family_office",
    "general_consultation",
    "other",
  ])
    .notNull()
    .default("general_consultation"),
  topic: text("topic"),
  notes: text("notes"),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"])
    .notNull()
    .default("scheduled"),
  isNew: boolean("isNew").notNull().default(true),
  bookedVia: varchar("bookedVia", { length: 50 }).default("reality_chatbot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trademarkProjects = mysqlTable("trademark_projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  workspaceId: varchar("workspaceId", { length: 128 }),
  title: varchar("title", { length: 255 }).notNull(),
  markType: mysqlEnum("markType", ["standard", "special", "sound"]).notNull().default("standard"),
  status: mysqlEnum("status", ["draft", "ready", "review"]).notNull().default("draft"),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustScenePlanRecords = mysqlTable("trust_scene_plan_records", {
  id: int("id").autoincrement().primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  metadataJson: text("metadataJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const watchlistSymbols = mysqlTable("watchlist_symbols", {
  id: varchar("id", { length: 36 }).primaryKey(),
  watchlistId: varchar("watchlistId", { length: 36 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export const web3SiteTemplates = mysqlTable("web3_site_templates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  description: text("description"),
  schemaJson: text("schemaJson").notNull(),
  trustId: varchar("trustId", { length: 36 }),
  workspaceId: varchar("workspaceId", { length: 36 }),
  clientId: varchar("clientId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const wizardSessions = mysqlTable("wizard_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  trustId: varchar("trustId", { length: 36 }),
  kind: mysqlEnum("kind", ["IRREVOCABLE_TRUST"]).notNull(),
  status: mysqlEnum("status", ["DRAFT", "REVIEW", "LOCKED", "GENERATED"]).notNull().default("DRAFT"),
  currentStep: varchar("currentStep", { length: 50 }).notNull().default("state"),
  dataJson: text("dataJson").notNull().default("{}"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const meetingNodeEvents = mysqlTable("meeting_node_events", {
  id: int("id").autoincrement().primaryKey(),
  event: varchar("event", { length: 64 }).notNull(),
  nodeId: varchar("nodeId", { length: 36 }),
  roomId: varchar("roomId", { length: 80 }),
  worldId: varchar("worldId", { length: 64 }),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustAssetEvents = mysqlTable("trust_asset_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }),
  assetId: varchar("assetId", { length: 36 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustAssetInstruments = mysqlTable("trust_asset_instruments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  instrumentType: varchar("instrumentType", { length: 100 }),
  issuer: varchar("issuer", { length: 255 }),
  faceValue: decimal("faceValue", { precision: 18, scale: 2 }),
  issueDate: date("issueDate"),
  transferability: varchar("transferability", { length: 100 }),
  cusip: varchar("cusip", { length: 20 }),
  transferAgent: varchar("transferAgent", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustBrokerageAccounts = mysqlTable("trust_brokerage_accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  institution: varchar("institution", { length: 255 }),
  accountNumber: varchar("accountNumber", { length: 255 }),
  accountType: varchar("accountType", { length: 50 }),
  authorizedBroker: varchar("authorizedBroker", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustInstruments = mysqlTable("trust_instruments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  workspaceId: varchar("workspaceId", { length: 36 }),
  instrumentKind: mysqlEnum("instrumentKind", [
    "CERTIFICATE",
    "BOND",
    "PROMISSORY_NOTE",
    "SECURED_NOTE",
    "PPM_SECURITY",
    "OTHER",
  ]).notNull(),
  instrumentSubtype: varchar("instrumentSubtype", { length: 80 }),
  status: mysqlEnum("status", [
    "DRAFT",
    "AUTHORITY_REVIEW",
    "COLLATERALIZED",
    "GOVERNANCE_APPROVED",
    "READY_TO_ISSUE",
    "ISSUED",
    "SIGNED",
    "PACKAGED",
    "DEPOSIT_INITIATED",
    "DEPOSIT_COMPLETED",
    "VOIDED",
    "DEFAULTED",
    "REDEEMED",
    "MATURED",
  ])
    .notNull()
    .default("DRAFT"),
  serialNumber: varchar("serialNumber", { length: 80 }),
  issuerName: varchar("issuerName", { length: 255 }),
  governingLaw: varchar("governingLaw", { length: 100 }),
  faceValue: decimal("faceValue", { precision: 18, scale: 6 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  issueDate: date("issueDate"),
  maturityDate: date("maturityDate"),
  ppmDocumentId: varchar("ppmDocumentId", { length: 36 }),
  governingResolutionId: varchar("governingResolutionId", { length: 36 }),
  collateralPoolId: varchar("collateralPoolId", { length: 36 }),
  debtInstrumentId: varchar("debtInstrumentId", { length: 36 }),
  certificateRefId: varchar("certificateRefId", { length: 36 }),
  createdBy: varchar("createdBy", { length: 36 }),
  signedAt: timestamp("signedAt"),
  signedBy: varchar("signedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustCollateralPools = mysqlTable("trust_collateral_pools", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  coverageRatio: decimal("coverageRatio", { precision: 8, scale: 4 }),
  haircutMethod: varchar("haircutMethod", { length: 80 }),
  valuationDate: date("valuationDate"),
  totalEstimatedValue: decimal("totalEstimatedValue", { precision: 18, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustCollateralPoolAssets = mysqlTable("trust_collateral_pool_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  poolId: varchar("poolId", { length: 36 }).notNull(),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  allocatedValue: decimal("allocatedValue", { precision: 18, scale: 2 }),
  lienPosition: int("lienPosition"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustInstrumentEvents = mysqlTable("trust_instrument_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  instrumentId: varchar("instrumentId", { length: 36 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  metadata: json("metadata"),
  actorRole: varchar("actorRole", { length: 80 }),
  actorId: varchar("actorId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustBondholderRegister = mysqlTable("trust_bondholder_register", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  debtInstrumentId: varchar("debtInstrumentId", { length: 36 }).notNull(),
  holderName: varchar("holderName", { length: 200 }).notNull(),
  holderEntityType: varchar("holderEntityType", { length: 80 }),
  holderContact: text("holderContact"),
  principalHeld: decimal("principalHeld", { precision: 18, scale: 6 }).notNull(),
  issueDate: date("issueDate").notNull(),
  registerEntryStatus: mysqlEnum("registerEntryStatus", ["active", "redeemed", "cancelled"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustDebtCollateral = mysqlTable("trust_debt_collateral", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  debtInstrumentId: varchar("debtInstrumentId", { length: 36 }).notNull(),
  collateralType: mysqlEnum("collateralType", [
    "none",
    "ucc_personal_property",
    "real_property",
    "revenue_assignment",
    "cash_collateral",
    "other",
  ]).notNull(),
  description: text("description"),
  uccFilingNumber: varchar("uccFilingNumber", { length: 120 }),
  recordingOffice: varchar("recordingOffice", { length: 200 }),
  recordingReference: varchar("recordingReference", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustDebtDisclosures = mysqlTable("trust_debt_disclosures", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  debtInstrumentId: varchar("debtInstrumentId", { length: 36 }).notNull(),
  disclosureDocType: mysqlEnum("disclosureDocType", [
    "ppm",
    "subscription_agreement",
    "risk_factors",
    "conflicts",
    "term_sheet",
    "other",
  ]).notNull(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  documentId: varchar("documentId", { length: 36 }),
  isRequired: boolean("isRequired").notNull().default(true),
  isComplete: boolean("isComplete").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const socialGenerationRuns = mysqlTable("social_generation_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("complete"),
  topic: text("topic"),
  sourcePrompt: text("source_prompt"),
  metadataJson: json("metadata_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type MinuteBookRow = typeof minuteBooks.$inferSelect;
export type MinuteParticipantRow = typeof minuteParticipants.$inferSelect;
