/**
 * Tables defined in `drizzle/*.sql` that app code imports from `@/lib/db/schema`.
 * Column names match MySQL/TiDB physical names (camelCase where migrations use it).
 */
import {
  boolean,
  date,
  decimal,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// --- Accounting bridge (drizzle/0010_add_accounting_bridge_tables.sql) ---

export const accountingEventInbox = mysqlTable("accounting_event_inbox", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sourceSystem: varchar("sourceSystem", { length: 80 }).notNull().default("trust_records"),
  sourceEventType: varchar("sourceEventType", { length: 100 }).notNull(),
  sourceEventId: varchar("sourceEventId", { length: 36 }),
  payload: json("payload").$type<Record<string, unknown> | null>(),
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "processed", "failed"])
    .notNull()
    .default("pending"),
  processedAt: timestamp("processedAt"),
  processedByUserId: int("processedByUserId"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const accountingFinancingProfiles = mysqlTable("accounting_financing_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  instrumentId: varchar("instrumentId", { length: 36 }),
  principalAmount: decimal("principalAmount", { precision: 18, scale: 6 }),
  outstandingPrincipal: decimal("outstandingPrincipal", { precision: 18, scale: 6 }),
  interestRate: decimal("interestRate", { precision: 8, scale: 4 }),
  accruedInterest: decimal("accruedInterest", { precision: 18, scale: 6 }),
  nextPaymentDate: date("nextPaymentDate"),
  maturityDate: date("maturityDate"),
  status: varchar("status", { length: 50 }).default("active"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const accountingAssetEncumbrances = mysqlTable("accounting_asset_encumbrances", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  assetId: varchar("assetId", { length: 36 }).notNull(),
  instrumentId: varchar("instrumentId", { length: 36 }),
  pledgedValue: decimal("pledgedValue", { precision: 18, scale: 2 }),
  lienPosition: int("lienPosition"),
  coverageRatio: decimal("coverageRatio", { precision: 8, scale: 4 }),
  effectiveDate: date("effectiveDate"),
  releaseDate: date("releaseDate"),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// --- Crypto / merch (drizzle/0001_add_marketplace_phone.sql) ---

export const cryptoBubbleSettings = mysqlTable("crypto_bubble_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  currency: varchar("currency", { length: 50 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isEnabled: boolean("isEnabled").notNull().default(true),
  displayOrder: int("displayOrder").default(0),
  color: varchar("color", { length: 7 }),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const merchJobs = mysqlTable("merch_jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: mysqlEnum("type", ["RENDER", "INPAINT", "EXPORT_ZIP", "EXPORT_PDF"]).notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]).notNull().default("QUEUED"),
  inputJson: json("inputJson").$type<Record<string, unknown> | null>(),
  outputJson: json("outputJson").$type<Record<string, unknown> | null>(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cryptoTransactions = mysqlTable("crypto_transactions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  transactionId: varchar("transactionId", { length: 255 }).notNull(),
  userAddress: varchar("userAddress", { length: 255 }).notNull(),
  transactionType: mysqlEnum("transactionType", ["deposit", "withdraw", "exchange", "transfer", "fee"]).notNull(),
  currency: varchar("currency", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 20, scale: 8 }).default("0.00"),
  status: mysqlEnum("status", ["pending", "completed", "declined", "cancelled"]).default("pending"),
  txHash: varchar("txHash", { length: 255 }),
  fromAddress: varchar("fromAddress", { length: 255 }),
  toAddress: varchar("toAddress", { length: 255 }),
  chain: varchar("chain", { length: 50 }),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const currencyPrices = mysqlTable("currency_prices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  currency: varchar("currency", { length: 50 }).notNull(),
  priceUSD: decimal("priceUSD", { precision: 20, scale: 8 }).notNull(),
  priceChange24h: decimal("priceChange24h", { precision: 10, scale: 4 }),
  volume24h: decimal("volume24h", { precision: 20, scale: 8 }),
  marketCap: decimal("marketCap", { precision: 20, scale: 2 }),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

export const userWallets = mysqlTable("user_wallets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userAddress: varchar("userAddress", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 50 }).notNull(),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0.00"),
  lockedBalance: decimal("lockedBalance", { precision: 20, scale: 8 }).default("0.00"),
  walletAddress: varchar("walletAddress", { length: 255 }),
  chain: varchar("chain", { length: 50 }),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// --- Trust governance (drizzle/0000 + 0001) ---

export const trustResolutions = mysqlTable("trust_resolutions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  resolutionType: mysqlEnum("resolutionType", ["bond_issuance", "security_offer", "amendment", "other"]).notNull(),
  title: varchar("title", { length: 200 }),
  purpose: text("purpose"),
  authorityBasis: text("authorityBasis"),
  principalAmount: decimal("principalAmount", { precision: 18, scale: 6 }),
  interestRate: decimal("interestRate", { precision: 5, scale: 4 }),
  maturityDate: date("maturityDate"),
  securitiesExemption: mysqlEnum("securitiesExemption", ["reg_d_506b", "reg_d_506c"]),
  executionDate: timestamp("executionDate"),
  adoptedByUserId: varchar("adoptedByUserId", { length: 36 }),
  adoptedByName: varchar("adoptedByName", { length: 200 }),
  documentId: varchar("documentId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const minutes = mysqlTable("minutes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  minuteBookId: varchar("minuteBookId", { length: 36 }).notNull(),
  recordType: mysqlEnum("recordType", ["meeting", "written_consent"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  actionDate: date("actionDate").notNull(),
  actionTime: varchar("actionTime", { length: 10 }),
  location: varchar("location", { length: 500 }),
  calledBy: varchar("calledBy", { length: 255 }),
  chair: varchar("chair", { length: 255 }),
  quorumRequired: boolean("quorumRequired").notNull().default(true),
  quorumMet: boolean("quorumMet").notNull().default(false),
  agenda: text("agenda"),
  status: mysqlEnum("status", ["draft", "pending", "approved", "locked"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  submittedAt: timestamp("submittedAt"),
  approvedAt: timestamp("approvedAt"),
  finalizedAt: timestamp("finalizedAt"),
  hash: varchar("hash", { length: 64 }),
});

export const resolutions = mysqlTable("resolutions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  minutesId: varchar("minutesId", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  resolutionType: mysqlEnum("resolutionType", [
    "Organizational",
    "Banking",
    "AssetAcquisition",
    "AssetSale",
    "ContractApproval",
    "TaxElection",
    "OfficerAppointment",
    "ManagerAppointment",
    "DelegationOfAuthority",
    "StandingResolution",
    "Other",
  ]).notNull(),
  text: text("text").notNull(),
  effectiveDate: date("effectiveDate").notNull(),
  expirationDate: date("expirationDate"),
  monetaryThreshold: decimal("monetaryThreshold", { precision: 18, scale: 2 }),
  maxDollarThreshold: decimal("maxDollarThreshold", { precision: 18, scale: 2 }),
  requiresAnnualReaffirmation: boolean("requiresAnnualReaffirmation").notNull().default(false),
  lastReaffirmedAt: date("lastReaffirmedAt"),
  counterparty: varchar("counterparty", { length: 255 }),
  approvalThreshold: mysqlEnum("approvalThreshold", ["Majority", "Supermajority", "Unanimous"])
    .notNull()
    .default("Majority"),
  isStanding: boolean("isStanding").notNull().default(false),
  standingScope: text("standingScope"),
  status: mysqlEnum("status", ["draft", "approved", "rejected"]).notNull().default("draft"),
});

const oasisListingCurrency = [
  "TROO",
  "TROO_POO",
  "XRP",
  "SOL",
  "POL",
  "BTC",
  "ETH",
  "BNB",
  "USDC",
] as const;

// --- OASIS catalog / worlds (drizzle/0001_add_marketplace_phone.sql) ---

export const oasisWorlds = mysqlTable("oasis_worlds", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  summary: text("summary"),
  description: text("description"),
  engine: mysqlEnum("engine", ["unity", "unreal", "webgl", "custom"]).notNull().default("unity"),
  modelUri: text("modelUri"),
  previewImageUri: text("previewImageUri"),
  tags: text("tags"),
  isPublished: boolean("isPublished").notNull().default(false),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisWorldEvents = mysqlTable("oasis_world_events", {
  id: int("id").autoincrement().primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  payload: text("payload"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oasisWorldVersions = mysqlTable("oasis_world_versions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  sceneGraph: text("sceneGraph").notNull(),
  seed: int("seed").notNull().default(0),
  readinessHash: varchar("readinessHash", { length: 64 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oasisMarketListings = mysqlTable("oasis_market_listings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  itemType: mysqlEnum("itemType", ["world", "object", "pack"]).notNull(),
  itemRefId: varchar("itemRefId", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  description: text("description"),
  previewImageUri: text("previewImageUri"),
  engine: mysqlEnum("engine", ["unity", "unreal", "webgl", "custom", "universal"]).notNull().default("universal"),
  price: decimal("price", { precision: 18, scale: 6 }).notNull().default("0"),
  currency: mysqlEnum("currency", oasisListingCurrency).notNull().default("TROO"),
  isPublished: boolean("isPublished").notNull().default(false),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisAssetPacks = mysqlTable("oasis_asset_packs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  summary: text("summary"),
  description: text("description"),
  engine: mysqlEnum("engine", ["unity", "unreal", "universal"]).notNull().default("universal"),
  previewImageUri: text("previewImageUri"),
  packManifestUri: text("packManifestUri"),
  includedElementIds: text("includedElementIds"),
  tags: text("tags"),
  isPublished: boolean("isPublished").notNull().default(false),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// --- Troo street elements (drizzle/0004_add_troo_world_elements.sql) ---

export const trooWorldElements = mysqlTable("troo_world_elements", {
  id: int("id").autoincrement().primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull().default("default"),
  type: mysqlEnum("type", [
    "tree",
    "street_light",
    "bench",
    "road_segment",
    "crosswalk",
    "bush",
    "fountain",
  ]).notNull(),
  posX: decimal("posX", { precision: 12, scale: 4 }).notNull().default("0"),
  posY: decimal("posY", { precision: 12, scale: 4 }).notNull().default("0"),
  posZ: decimal("posZ", { precision: 12, scale: 4 }).notNull().default("0"),
  rotY: decimal("rotY", { precision: 12, scale: 4 }).notNull().default("0"),
  scale: decimal("scale", { precision: 12, scale: 4 }).notNull().default("1"),
  colorHex: int("colorHex"),
  color2Hex: int("color2Hex"),
  label: varchar("label", { length: 128 }),
  isDefault: boolean("isDefault").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** `drizzle/0003_add_troo_world_tables.sql` */
export const trooWorlds = mysqlTable("troo_worlds", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  isDefault: boolean("isDefault").notNull().default(false),
  isPublished: boolean("isPublished").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trooWorldPlacements = mysqlTable("troo_world_placements", {
  id: int("id").autoincrement().primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  elementKey: varchar("elementKey", { length: 80 }).notNull(),
  glbUrl: text("glbUrl").notNull(),
  posX: decimal("posX", { precision: 12, scale: 4 }).notNull(),
  posY: decimal("posY", { precision: 12, scale: 4 }).notNull(),
  posZ: decimal("posZ", { precision: 12, scale: 4 }).notNull(),
  scale: decimal("scale", { precision: 12, scale: 4 }).notNull().default("1"),
  rotY: decimal("rotY", { precision: 12, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** `drizzle/0074_meeting_node_placements.sql` — camelCase physical columns. */
export const meetingNodePlacements = mysqlTable("meeting_node_placements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  parentPlacementId: int("parentPlacementId").notNull(),
  parentSystem: varchar("parentSystem", { length: 24 }).notNull().default("troo_placement"),
  nodeAssetKey: varchar("nodeAssetKey", { length: 80 }).notNull().default("corporate_meeting_node_v1"),
  roomId: varchar("roomId", { length: 80 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  accessType: mysqlEnum("accessType", ["public", "private", "invite_only"]).notNull().default("public"),
  capacity: int("capacity").notNull().default(12),
  webEnabled: boolean("webEnabled").notNull().default(true),
  webxrEnabled: boolean("webxrEnabled").notNull().default(false),
  vrEnabled: boolean("vrEnabled").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  posX: decimal("posX", { precision: 12, scale: 4 }).notNull(),
  posY: decimal("posY", { precision: 12, scale: 4 }).notNull(),
  posZ: decimal("posZ", { precision: 12, scale: 4 }).notNull(),
  rotY: decimal("rotY", { precision: 12, scale: 4 }).notNull().default("0"),
  scale: decimal("scale", { precision: 12, scale: 4 }).notNull().default("1"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const meetingInvites = mysqlTable("meeting_invites", {
  id: varchar("id", { length: 36 }).primaryKey(),
  meetingNodeId: varchar("meetingNodeId", { length: 36 }).notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  inviteeUserId: int("inviteeUserId"),
  inviteeEmail: varchar("inviteeEmail", { length: 320 }),
  inviteeWallet: varchar("inviteeWallet", { length: 42 }),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "revoked", "expired"]).notNull().default("pending"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// --- NPCs (drizzle/0001 + alters in 0003, 0005, 0006) ---

export const oasisNpcKnowledge = mysqlTable("oasis_npc_knowledge", {
  id: int("id").autoincrement().primaryKey(),
  npcId: int("npcId").notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  keywords: text("keywords").notNull(),
  content: text("content").notNull(),
  priority: int("priority").notNull().default(5),
  category: mysqlEnum("category", ["world", "business", "product", "navigation", "general"])
    .notNull()
    .default("general"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisNpcs = mysqlTable("oasis_npcs", {
  id: int("id").autoincrement().primaryKey(),
  npcId: varchar("npcId", { length: 128 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["secretary", "avatar", "guide", "voice_agent", "executive_admin"]).notNull(),
  title: varchar("title", { length: 200 }),
  avatarEmoji: varchar("avatarEmoji", { length: 16 }).notNull().default("🤖"),
  voiceStyle: mysqlEnum("voiceStyle", ["professional", "friendly", "authoritative", "warm"]).default("friendly"),
  worldId: varchar("worldId", { length: 128 }),
  ownerId: int("ownerId"),
  greeting: text("greeting"),
  farewell: text("farewell"),
  personalityJson: text("personalityJson"),
  mood: mysqlEnum("mood", ["neutral", "happy", "busy", "concerned", "excited", "formal"]).notNull().default("neutral"),
  isDefault: boolean("isDefault").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  language: varchar("language", { length: 16 }),
  buildingId: varchar("buildingId", { length: 64 }),
  floor: int("floor"),
  telegramBotToken: varchar("telegramBotToken", { length: 256 }),
  telegramWebhookKey: varchar("telegramWebhookKey", { length: 64 }),
  telegramConnectedAt: timestamp("telegramConnectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** drizzle/0122_executive_agent_audit_and_approvals.sql */
export const executiveAgentAuditLogs = mysqlTable("executive_agent_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  prompt: text("prompt"),
  toolName: varchar("toolName", { length: 120 }).notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 191 }),
  inputJson: text("inputJson"),
  outputJson: text("outputJson"),
  approvalStatus: varchar("approvalStatus", { length: 32 }).notNull().default("not_required"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const executiveAgentApprovals = mysqlTable("executive_agent_approvals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  proposedAction: varchar("proposedAction", { length: 120 }).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 191 }),
  payloadJson: text("payloadJson").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "executed", "failed"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  executedAt: timestamp("executedAt"),
});

/** drizzle/0123_executive_agent_voice.sql — text + JSON only; no audio blobs. */
export const executiveAgentVoiceSessions = mysqlTable("executive_agent_voice_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["active", "ended"]).notNull().default("active"),
  inputMode: varchar("inputMode", { length: 32 }).notNull(),
  outputMode: varchar("outputMode", { length: 32 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  clientConfigJson: text("clientConfigJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});

export const executiveAgentVoiceTurns = mysqlTable("executive_agent_voice_turns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  adminUserId: int("adminUserId").notNull(),
  transcriptText: text("transcriptText").notNull(),
  responseText: text("responseText").notNull(),
  plannerMetaJson: text("plannerMetaJson"),
  proposedApprovalsCount: int("proposedApprovalsCount").notNull().default(0),
  orchestratorSource: varchar("orchestratorSource", { length: 24 }).notNull().default("voice"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const EXECUTIVE_MEMORY_TYPES = [
  "preference",
  "client_priority",
  "recurring_issue",
  "agent_pattern",
  "system_note",
  "decision",
] as const;

export const EXECUTIVE_MEMORY_SOURCES = ["chat", "voice", "approval", "system"] as const;

/** drizzle/0124_executive_agent_memory_briefing.sql */
export const executiveAgentMemoryItems = mysqlTable("executive_agent_memory_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  memoryType: mysqlEnum("memoryType", EXECUTIVE_MEMORY_TYPES).notNull(),
  subjectType: varchar("subjectType", { length: 64 }),
  subjectId: varchar("subjectId", { length: 191 }),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary").notNull(),
  source: mysqlEnum("source", EXECUTIVE_MEMORY_SOURCES).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull().default("0.8000"),
  expiresAt: timestamp("expiresAt"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const executiveAgentBriefings = mysqlTable("executive_agent_briefings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  briefingDate: varchar("briefingDate", { length: 10 }).notNull(),
  summaryJson: text("summaryJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const EXECUTIVE_ROUTINE_TYPES = [
  "daily_briefing",
  "stale_client_scan",
  "pending_account_scan",
  "bentley_readiness_scan",
  "approval_digest",
  "skipper_learning_digest",
] as const;

export const EXECUTIVE_ROUTINE_CADENCES = ["daily", "hourly", "weekly"] as const;

/** drizzle/0125_executive_agent_routines.sql */
export const executiveAgentRoutines = mysqlTable("executive_agent_routines", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  routineType: mysqlEnum("routineType", EXECUTIVE_ROUTINE_TYPES).notNull(),
  cadence: mysqlEnum("cadence", EXECUTIVE_ROUTINE_CADENCES).notNull().default("daily"),
  enabled: boolean("enabled").notNull().default(true),
  configJson: text("configJson").notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt").notNull(),
  lastOutputJson: text("lastOutputJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** drizzle/0126_executive_analytics_knowledge_inbox.sql */
export const SITE_ANALYTICS_EVENT_TYPES = [
  "page_view",
  "button_click",
  "conversion_intent",
  "outbound_paypal",
  "agent_interaction",
] as const;

export const siteAnalyticsEvents = mysqlTable("site_analytics_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  eventType: mysqlEnum("eventType", SITE_ANALYTICS_EVENT_TYPES).notNull(),
  source: varchar("source", { length: 64 }).notNull().default(""),
  medium: varchar("medium", { length: 64 }).notNull().default(""),
  campaign: varchar("campaign", { length: 128 }).notNull().default(""),
  referrer: text("referrer"),
  userAgent: text("userAgent"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const EXECUTIVE_QUESTION_SOURCES = ["chat", "voice"] as const;

export const executiveAgentQuestionHistory = mysqlTable("executive_agent_question_history", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  source: mysqlEnum("source", EXECUTIVE_QUESTION_SOURCES).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  selectedAgentsJson: text("selectedAgentsJson"),
  selectedTimeRange: varchar("selectedTimeRange", { length: 32 }),
  dashboardMode: varchar("dashboardMode", { length: 64 }),
  plannerMetaJson: text("plannerMetaJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const EXECUTIVE_KNOWLEDGE_SOURCE_TYPES = ["note", "url", "upload", "crawl"] as const;

export const executiveAgentKnowledgeDocuments = mysqlTable("executive_agent_knowledge_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  sourceType: mysqlEnum("sourceType", EXECUTIVE_KNOWLEDGE_SOURCE_TYPES).notNull(),
  sourceUrl: text("sourceUrl"),
  contentText: longtext("contentText").notNull(),
  summary: text("summary"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const EXECUTIVE_DEPARTMENT_MESSAGE_KINDS = ["user_to_executive", "executive_to_user", "executive_broadcast"] as const;

export const executiveDepartmentMessages = mysqlTable("executive_department_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  kind: mysqlEnum("kind", EXECUTIVE_DEPARTMENT_MESSAGE_KINDS).notNull(),
  fromAdminUserId: int("fromAdminUserId"),
  fromMarketplaceUserId: int("fromMarketplaceUserId"),
  toMarketplaceUserId: int("toMarketplaceUserId"),
  bodyText: text("bodyText").notNull(),
  metadataJson: text("metadataJson"),
  /** JSON array of ExecutiveInboxAttachment (see executive-inbox-attachments.ts) */
  attachmentsJson: text("attachmentsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** drizzle/0127_skipper_controlled_learning.sql */
export const skipperLearningEvents = mysqlTable("skipper_learning_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  source: varchar("source", { length: 32 }).notNull().default("chat"),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const skipperLearningSummaries = mysqlTable("skipper_learning_summaries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  windowStart: timestamp("windowStart").notNull(),
  windowEnd: timestamp("windowEnd").notNull(),
  compressedJson: text("compressedJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const SKIPPER_IMPROVEMENT_SUGGESTION_STATUSES = ["pending", "approved", "rejected"] as const;

export const skipperPromptImprovementSuggestions = mysqlTable("skipper_prompt_improvement_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  summaryId: varchar("summaryId", { length: 36 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  rationale: text("rationale").notNull(),
  proposedOverlayContent: text("proposedOverlayContent").notNull(),
  status: mysqlEnum("status", SKIPPER_IMPROVEMENT_SUGGESTION_STATUSES).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const skipperCapabilitySuggestions = mysqlTable("skipper_capability_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  summaryId: varchar("summaryId", { length: 36 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  suggestedFlagKey: varchar("suggestedFlagKey", { length: 120 }),
  status: mysqlEnum("status", SKIPPER_IMPROVEMENT_SUGGESTION_STATUSES).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const SKIPPER_PROMPT_OVERLAY_STATUSES = ["pending", "approved", "rejected", "active", "archived"] as const;

export const skipperPromptOverlays = mysqlTable("skipper_prompt_overlays", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", SKIPPER_PROMPT_OVERLAY_STATUSES).notNull().default("pending"),
  sourceSummaryId: varchar("sourceSummaryId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

export const oasisNpcSessions = mysqlTable("oasis_npc_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  npcId: int("npcId").notNull(),
  npcNpcId: varchar("npcNpcId", { length: 128 }).notNull(),
  userId: int("userId"),
  currentTopic: varchar("currentTopic", { length: 255 }),
  messageCount: int("messageCount").notNull().default(0),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastActivity: timestamp("lastActivity").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  jarvaWorkflowPath: varchar("jarvaWorkflowPath", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oasisNpcMessages = mysqlTable("oasis_npc_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  intent: varchar("intent", { length: 100 }),
  intentConfidence: int("intentConfidence"),
  sentiment: varchar("sentiment", { length: 16 }),
  responseSource: varchar("responseSource", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertOasisNpcRow = typeof oasisNpcs.$inferInsert;
