// src/lib/db/schema.ts
import { mysqlEnum, mysqlTable, int, varchar, boolean, timestamp, text, decimal, date } from "drizzle-orm/mysql-core";

// Re-export split runtime schemas so consumers can continue importing from "@/lib/db/schema".
export * from "./schema.app-runtime";
export * from "./schema.client-portal";
export * from "./schema.social-runtime";
export * from "./schema.platform-extras";

export const marketplaceUsers = mysqlTable("marketplace_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  isActive: boolean("isActive").default(false).notNull(),
  isApproved: boolean("isApproved").default(false).notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }),
  hasTokenAccess: boolean("hasTokenAccess").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLogin: timestamp("lastLogin"),
});

export const adminLogs = mysqlTable("admin_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: int("targetUserId"),
  targetEmail: varchar("targetEmail", { length: 320 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Entity onboarding submissions (user uploads required documents; admin can revoke)
export const entityOnboardings = mysqlTable("entity_onboardings", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("userId").notNull(),

  companyName: varchar("companyName", { length: 255 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),

  // Only store last 4 digits for security
  taxIdLast4: varchar("taxIdLast4", { length: 4 }).notNull(),

  serviceTier: varchar("serviceTier", { length: 30 }).notNull(),
  primaryContact: varchar("primaryContact", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  phone: varchar("phone", { length: 50 }),

  onboardingStatus: varchar("onboardingStatus", { length: 50 })
    .default("submitted")
    .notNull(),

  letterOfGoodOperationUri: text("letterOfGoodOperationUri"),
  articlesOfIncorporationUri: text("articlesOfIncorporationUri"),

  isRevoked: boolean("isRevoked").default(false).notNull(),
  revokedReason: text("revokedReason"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// OASIS: World Elements + Categories
// -----------------------------

export const oasisElementCategories = mysqlTable("oasis_element_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oasisWorldElements = mysqlTable("oasis_world_elements", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  // Optional stable identifier for UI/URLs (admin-defined). Not required for legacy rows.
  slug: varchar("slug", { length: 180 }),
  description: text("description"),
  // Stored as ipfs://... URIs
  assetUri: text("assetUri").notNull(),
  previewImageUri: text("previewImageUri"),
  // Creator payout wallet (used by purchase flow for revenue split)
  creatorWallet: varchar("creatorWallet", { length: 140 }),
  // Optional payout splits for multiple beneficiaries as JSON array:
  // [{ wallet: "0x...", pct: 60 }, { wallet: "r...", pct: 40 }]
  payoutSplits: text("payoutSplits"),
  // Optional list of accepted currencies as JSON array, e.g. ["ETH","USDC","XRP"]
  acceptedCurrencies: text("acceptedCurrencies"),
  // Pricing (optional for legacy rows)
  price: decimal("price", { precision: 18, scale: 6 }).default("0").notNull(),
  currency: mysqlEnum("currency", ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"]).default("TROO").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// OASIS: Buildings (user-customizable building blueprints)
// -----------------------------
export const oasisBuildings = mysqlTable("oasis_buildings", {
  id: varchar("id", { length: 80 }).primaryKey(), // client-generated ids (bld_... etc)
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["house", "apartment", "storefront", "warehouse", "office"]).notNull(),
  description: text("description"),
  data: text("data").notNull(), // JSON stringified Building.export()
  thumbnail: text("thumbnail"),
  version: int("version").default(1).notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  tags: text("tags").default("[]").notNull(), // JSON array
  metadata: text("metadata"), // JSON object
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Community Posts
// -----------------------------

export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  text: text("text"),
  visibility: mysqlEnum("visibility", ["public", "private"]).default("public").notNull(),
  // Optional media (stored as data URL for now; for production use object storage)
  mediaType: mysqlEnum("mediaType", ["image", "video", "audio"]),
  mediaUrl: text("mediaUrl"),
  audioUrl: text("audioUrl"),
  score: int("score").default(0).notNull(),
  votes: int("votes").default(0).notNull(),
  superVotes: int("superVotes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Email Notifications (tracking outbound emails)
// -----------------------------

export const emailNotifications = mysqlTable("email_notifications", {
  id: varchar("id", { length: 191 }).primaryKey(), // uuid
  userId: int("userId"),
  registrationId: varchar("registrationId", { length: 191 }),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  emailType: varchar("emailType", { length: 80 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["PENDING", "SENT", "FAILED", "BOUNCED"]).default("PENDING").notNull(),
  failureReason: text("failureReason"),
  sentAt: timestamp("sentAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Trust Records (Trust Certificates Console)
// -----------------------------

export const trusts = mysqlTable("trusts", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["draft", "finalized", "signed", "recorded", "error"]).default("draft").notNull(),
  source: varchar("source", { length: 40 }),
  // Optional onboarding/workspace fields (non-breaking; legacy trust-records flows can ignore these)
  clientId: varchar("clientId", { length: 36 }),
  name: varchar("name", { length: 255 }),
  trustType: mysqlEnum("trustType", [
    "revocable_living_trust",
    "irrevocable_trust",
    "testamentary_trust",
    "special_purpose_trust",
  ]),
  jurisdictionState: varchar("jurisdictionState", { length: 10 }),
  governingLawState: varchar("governingLawState", { length: 10 }),
  workspaceStatus: mysqlEnum("workspaceStatus", ["draft", "in_review", "approved", "executed"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Client onboarding (agent-facing)
// -----------------------------

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  userId: int("userId").notNull(), // owning agent/user (multi-tenant guardrail)

  // Identity
  firstName: varchar("firstName", { length: 120 }).notNull(),
  middleName: varchar("middleName", { length: 120 }),
  lastName: varchar("lastName", { length: 120 }).notNull(),
  suffix: varchar("suffix", { length: 40 }),
  dateOfBirth: date("dateOfBirth"),

  // Contact
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),

  // Address
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 40 }).notNull(),
  postalCode: varchar("postalCode", { length: 20 }).notNull(),
  country: varchar("country", { length: 2 }).default("US").notNull(),

  // Metadata
  clientType: mysqlEnum("clientType", ["individual", "entity"]).default("individual").notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientNotes = mysqlTable("client_notes", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  clientId: varchar("clientId", { length: 36 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  visibility: mysqlEnum("visibility", ["internal", "client"]).default("internal").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Minimal audit log table for onboarding + trust lifecycle events (non-optional)
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  actorUserId: int("actorUserId"), // nullable for system/external events
  action: varchar("action", { length: 80 }).notNull(), // e.g., "client_created", "trust_created"
  entityType: varchar("entityType", { length: 40 }).notNull(), // e.g., "client", "trust"
  entityId: varchar("entityId", { length: 36 }).notNull(),
  metadataJson: text("metadataJson"), // JSON blob
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Trust workspace sub-resources (for guided checklist + future clause engine)
export const trustParties = mysqlTable("trust_parties", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["grantor", "trustee"]).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustBeneficiaries = mysqlTable("trust_beneficiaries", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  relationship: varchar("relationship", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustAssets = mysqlTable("trust_assets", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  assetType: varchar("assetType", { length: 80 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Trust-scoped controls / feature flags (enterprise gating).
export const trustControls = mysqlTable("trust_controls", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),

  // Securities module enablement is trust-scoped (do not rely on global/admin-only gating).
  securitiesEnabled: boolean("securitiesEnabled").default(false).notNull(),

  // Governance toggles (used to determine required approvals for issuance/transfer).
  requireCounselApproval: boolean("requireCounselApproval").default(true).notNull(),
  requireTrusteeApproval: boolean("requireTrusteeApproval").default(true).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trustDrafts = mysqlTable("trust_drafts", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  draftType: varchar("draftType", { length: 80 }).notNull(),
  schemaVersion: int("schemaVersion").notNull(),
  version: int("version").notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// -----------------------------
// Trust Documents + Disclosure/Proof metadata
// -----------------------------

export const trustDocuments = mysqlTable("trust_documents", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  // e.g. "Certificate", "Minutes", "Resolution", "Amendment", "TrustInstrument"
  docType: varchar("docType", { length: 80 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  version: int("version").notNull(),

  classification: mysqlEnum("classification", ["public", "demandable", "private"]).default("private").notNull(),
  disclosureState: mysqlEnum("disclosureState", ["not_shared", "shared", "shared_with_conditions", "revoked"])
    .default("not_shared")
    .notNull(),
  proofState: mysqlEnum("proofState", ["not_hashed", "hashed", "archived", "anchored"]).default("not_hashed").notNull(),

  // Optional content payload (JSON/text). For MVP we store canonicalized JSON for generated docs.
  contentJson: text("contentJson"),

  // Stored hashes/IDs are optional; presence drives UI chips
  canonicalHashSha256: varchar("canonicalHashSha256", { length: 128 }),
  archiveId: varchar("archiveId", { length: 191 }), // e.g., arweave tx id / storage pointer
  anchorTx: varchar("anchorTx", { length: 191 }), // chain tx hash (hash-only anchoring)

  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// -----------------------------
// Securities module (private placement issuance)
// -----------------------------

export const securityOfferings = mysqlTable("security_offerings", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["draft", "finalized", "cancelled", "error"]).default("draft").notNull(),
  offeringName: varchar("offeringName", { length: 255 }).notNull(),
  securityType: mysqlEnum("securityType", ["debt", "participation", "equity_like"]).notNull(),
  exemptionTag: varchar("exemptionTag", { length: 40 }).notNull(), // label-only: "506b" | "506c" | "other"
  counselApproved: boolean("counselApproved").default(false).notNull(),
  draftJson: text("draftJson").notNull(), // full wizard state snapshot
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Privacy-preserving holder registry: store minimal display name + pointer to KYC/CRM or encrypted blob.
export const securityHolders = mysqlTable("security_holders", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  holderRef: varchar("holderRef", { length: 191 }), // external ref / encrypted pointer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const securityCertificates = mysqlTable("security_certificates", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  offeringId: varchar("offeringId", { length: 36 }).notNull(),
  certificateNo: varchar("certificateNo", { length: 64 }).notNull(),
  // Holder registry linkage (source of truth). Keep holderName snapshot for immutable printing semantics.
  holderId: varchar("holderId", { length: 36 }).notNull(),
  holderName: varchar("holderName", { length: 255 }).notNull(),
  amount: varchar("amount", { length: 64 }).notNull(),
  custodyMode: mysqlEnum("custodyMode", ["holder_possession", "trustee_or_custodian_possession"]).notNull(),
  custodianName: varchar("custodianName", { length: 255 }),
  // Fast-path fields (derived from events; events are source of truth).
  possessionAcknowledgedAt: timestamp("possessionAcknowledgedAt"),
  possessionAcknowledgedMethod: varchar("possessionAcknowledgedMethod", { length: 80 }),
  // Link to the executed certificate trust document (created at issuance).
  executedDocumentId: varchar("executedDocumentId", { length: 36 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["issued", "voided", "replaced"]).default("issued").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const securityEvents = mysqlTable("security_events", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  offeringId: varchar("offeringId", { length: 36 }),
  certificateId: varchar("certificateId", { length: 36 }),

  eventType: mysqlEnum("eventType", [
    "CERT_ISSUED",
    "POSSESSION_ACKNOWLEDGED",
    "CUSTODY_CHANGED",
    "TRANSFER_REQUESTED",
    "TRANSFER_APPROVED",
    "TRANSFER_REJECTED",
    "CERT_REPLACEMENT_REQUESTED",
    "CERT_REPLACED",
  ]).notNull(),

  actorUserId: int("actorUserId"), // minimal for now (maps to session user)
  actorRole: varchar("actorRole", { length: 40 }), // trustee/counsel/officer/holder (display-only for now)
  payloadJson: text("payloadJson"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const securityTransferRequests = mysqlTable("security_transfer_requests", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  offeringId: varchar("offeringId", { length: 36 }).notNull(),
  certificateId: varchar("certificateId", { length: 36 }).notNull(),
  fromHolderId: varchar("fromHolderId", { length: 36 }).notNull(),
  toHolderId: varchar("toHolderId", { length: 36 }).notNull(),
  reason: text("reason"),
  effectiveDate: varchar("effectiveDate", { length: 32 }),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).default("PENDING").notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const securityTransferApprovals = mysqlTable("security_transfer_approvals", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  transferRequestId: varchar("transferRequestId", { length: 36 }).notNull(),
  roleRequired: varchar("roleRequired", { length: 40 }).notNull(), // trustee/counsel/officer
  approvedByUserId: int("approvedByUserId"),
  approvedAt: timestamp("approvedAt"),
  signatureJson: text("signatureJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const holderRegistry = mysqlTable("holder_registry", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  holderName: varchar("holderName", { length: 255 }).notNull(),
  holderEmail: varchar("holderEmail", { length: 320 }),
  accreditationEvidencePointer: varchar("accreditationEvidencePointer", { length: 191 }), // store pointer only
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const transferRequests = mysqlTable("transfer_requests", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  securityCertificateId: varchar("securityCertificateId", { length: 36 }).notNull(),
  fromHolderName: varchar("fromHolderName", { length: 255 }),
  toHolderName: varchar("toHolderName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  approvalsJson: text("approvalsJson"), // JSON approvals log
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documentRequests = mysqlTable("document_requests", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  // Role claimed by requestor (bank/auditor/regulator/court/counterparty/other)
  requestorRole: varchar("requestorRole", { length: 40 }).notNull(),
  requestorEmail: varchar("requestorEmail", { length: 320 }),
  purpose: text("purpose").notNull(),
  requestedDocumentIdsJson: text("requestedDocumentIdsJson").notNull(), // JSON array of trust_documents.id
  status: mysqlEnum("status", ["pending", "approved", "denied", "more_info"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documentDisclosures = mysqlTable("document_disclosures", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  requestId: varchar("requestId", { length: 36 }), // nullable for public shares
  documentId: varchar("documentId", { length: 36 }).notNull(),
  shareToken: varchar("shareToken", { length: 191 }).notNull(),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  conditionsJson: text("conditionsJson"), // JSON blob (purpose/role/expiry/etc)
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const accessLogs = mysqlTable("access_logs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID (string)
  trustId: varchar("trustId", { length: 36 }).notNull(),
  actorUserId: int("actorUserId"), // nullable for external link access
  actorWallet: varchar("actorWallet", { length: 140 }),
  action: varchar("action", { length: 80 }).notNull(), // view/download/share/revoke/approve/deny/etc
  documentId: varchar("documentId", { length: 36 }),
  disclosureId: varchar("disclosureId", { length: 36 }),
  metaJson: text("metaJson"), // JSON blob (ip, user-agent, request context)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trustRecordRoles = mysqlTable("trust_record_roles", {
  userId: int("userId").primaryKey(),
  role: mysqlEnum("role", ["Manager", "Trustee"]).default("Manager").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Store full Trust Records state as JSON for now (simple + production-safe for early rollout).
export const trustRecordStates = mysqlTable("trust_record_states", {
  userId: int("userId").primaryKey(),
  stateJson: text("stateJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Consultations (Consultant Profiles + Bookings)
// -----------------------------

// Admin-assigned consultant metadata (1 profile per user).
export const consultantProfiles = mysqlTable("consultant_profiles", {
  userId: int("userId").primaryKey(),
  specialty: varchar("specialty", { length: 140 }).notNull(),
  note: text("note"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const consultationBookings = mysqlTable("consultation_bookings", {
  id: int("id").autoincrement().primaryKey(),
  clientUserId: int("clientUserId").notNull(),
  consultantUserId: int("consultantUserId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["scheduled", "cancelled"]).default("scheduled").notNull(),
  clientNote: text("clientNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketplaceUser = typeof marketplaceUsers.$inferSelect;
export type InsertMarketplaceUser = typeof marketplaceUsers.$inferInsert;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;
export type EntityOnboarding = typeof entityOnboardings.$inferSelect;
export type InsertEntityOnboarding = typeof entityOnboardings.$inferInsert;
export type OasisElementCategory = typeof oasisElementCategories.$inferSelect;
export type InsertOasisElementCategory = typeof oasisElementCategories.$inferInsert;
export type OasisWorldElement = typeof oasisWorldElements.$inferSelect;
export type InsertOasisWorldElement = typeof oasisWorldElements.$inferInsert;
export type OasisBuilding = typeof oasisBuildings.$inferSelect;
export type InsertOasisBuilding = typeof oasisBuildings.$inferInsert;
export type CommunityPostRow = typeof communityPosts.$inferSelect;
export type InsertCommunityPostRow = typeof communityPosts.$inferInsert;
export type TrustRow = typeof trusts.$inferSelect;
export type InsertTrustRow = typeof trusts.$inferInsert;
export type ClientRow = typeof clients.$inferSelect;
export type InsertClientRow = typeof clients.$inferInsert;
export type ClientNoteRow = typeof clientNotes.$inferSelect;
export type InsertClientNoteRow = typeof clientNotes.$inferInsert;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type InsertAuditLogRow = typeof auditLogs.$inferInsert;
export type TrustPartyRow = typeof trustParties.$inferSelect;
export type InsertTrustPartyRow = typeof trustParties.$inferInsert;
export type TrustBeneficiaryRow = typeof trustBeneficiaries.$inferSelect;
export type InsertTrustBeneficiaryRow = typeof trustBeneficiaries.$inferInsert;
export type TrustAssetRow = typeof trustAssets.$inferSelect;
export type InsertTrustAssetRow = typeof trustAssets.$inferInsert;
export type TrustControlRow = typeof trustControls.$inferSelect;
export type InsertTrustControlRow = typeof trustControls.$inferInsert;
export type TrustDraftRow = typeof trustDrafts.$inferSelect;
export type InsertTrustDraftRow = typeof trustDrafts.$inferInsert;
export type TrustDocumentRow = typeof trustDocuments.$inferSelect;
export type InsertTrustDocumentRow = typeof trustDocuments.$inferInsert;
export type SecurityOfferingRow = typeof securityOfferings.$inferSelect;
export type InsertSecurityOfferingRow = typeof securityOfferings.$inferInsert;
export type SecurityHolderRow = typeof securityHolders.$inferSelect;
export type InsertSecurityHolderRow = typeof securityHolders.$inferInsert;
export type SecurityCertificateRow = typeof securityCertificates.$inferSelect;
export type InsertSecurityCertificateRow = typeof securityCertificates.$inferInsert;
export type SecurityEventRow = typeof securityEvents.$inferSelect;
export type InsertSecurityEventRow = typeof securityEvents.$inferInsert;
export type SecurityTransferRequestRow = typeof securityTransferRequests.$inferSelect;
export type InsertSecurityTransferRequestRow = typeof securityTransferRequests.$inferInsert;
export type SecurityTransferApprovalRow = typeof securityTransferApprovals.$inferSelect;
export type InsertSecurityTransferApprovalRow = typeof securityTransferApprovals.$inferInsert;
export type HolderRegistryRow = typeof holderRegistry.$inferSelect;
export type InsertHolderRegistryRow = typeof holderRegistry.$inferInsert;
export type TransferRequestRow = typeof transferRequests.$inferSelect;
export type InsertTransferRequestRow = typeof transferRequests.$inferInsert;
export type DocumentRequestRow = typeof documentRequests.$inferSelect;
export type InsertDocumentRequestRow = typeof documentRequests.$inferInsert;
export type DocumentDisclosureRow = typeof documentDisclosures.$inferSelect;
export type InsertDocumentDisclosureRow = typeof documentDisclosures.$inferInsert;
export type AccessLogRow = typeof accessLogs.$inferSelect;
export type InsertAccessLogRow = typeof accessLogs.$inferInsert;
export type TrustRecordRole = typeof trustRecordRoles.$inferSelect;
export type InsertTrustRecordRole = typeof trustRecordRoles.$inferInsert;
export type TrustRecordState = typeof trustRecordStates.$inferSelect;
export type InsertTrustRecordState = typeof trustRecordStates.$inferInsert;
export type ConsultantProfileRow = typeof consultantProfiles.$inferSelect;
export type InsertConsultantProfileRow = typeof consultantProfiles.$inferInsert;
export type ConsultationBookingRow = typeof consultationBookings.$inferSelect;
export type InsertConsultationBookingRow = typeof consultationBookings.$inferInsert;

// -----------------------------
// Trust Workflow: Sequences (for CID/TID/AC/PN/SA/PKG numbering)
// -----------------------------

export const workflowSequences = mysqlTable("workflow_sequences", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  scope: varchar("scope", { length: 191 }).notNull().unique(), // e.g., "CLIENT:2026", "TRUST:DE:2026", "CERT:<trustId>:2026"
  currentValue: int("currentValue").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// -----------------------------
// Trust Workflow: Client Profiles (CID issuance)
// -----------------------------

export const workflowClientProfiles = mysqlTable("workflow_client_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  userId: int("userId").notNull(),                // your auth user
  publicId: varchar("publicId", { length: 32 }).notNull().unique(), // "CID-2026-01492"
  fullName: varchar("fullName", { length: 255 }),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// -----------------------------
// Trust Workflow: Extend trusts table
// -----------------------------

// Add these fields to existing trusts table:
// publicId: varchar("publicId", { length: 40 }), // "TID-DE-2026-0007"
// authorityStatus: mysqlEnum("authorityStatus", ["not_confirmed", "confirmed", "generated_draft"]).default("not_confirmed"),
// authorityJson: text("authorityJson"), // checklist + metadata

// -----------------------------
// Trust Workflow: Workflow Assets (normalized, trust-scoped)
// -----------------------------

export const workflowTrustAssets = mysqlTable("workflow_trust_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),

  type: varchar("type", { length: 40 }).notNull(), // align w/ your AssetType union
  name: varchar("name", { length: 255 }).notNull(),
  identifier: varchar("identifier", { length: 191 }),
  valuationUSD: int("valuationUSD"),
  valuationAsOf: varchar("valuationAsOf", { length: 24 }),
  encumbrances: text("encumbrances"),
  evidenceNotes: text("evidenceNotes"),

  status: mysqlEnum("status", ["recorded", "certificated", "pledged", "archived"]).default("recorded"),

  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// -----------------------------
// Trust Workflow: Asset Certificates (AC-…)
// -----------------------------

export const workflowAssetCertificates = mysqlTable("workflow_asset_certificates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  assetId: varchar("assetId", { length: 36 }).notNull(),

  certificateNumber: varchar("certificateNumber", { length: 80 }).notNull().unique(), // "AC-{TID}-2026-0001"
  certificateClass: varchar("certificateClass", { length: 80 }).default("Unit"),
  units: int("units").default(1),

  restrictionsJson: text("restrictionsJson"), // { nonNegotiable: true, ... }

  // tie to your existing document infrastructure
  trustDocumentId: varchar("trustDocumentId", { length: 36 }), // trust_documents.id

  createdAt: timestamp("createdAt").defaultNow(),
});

// -----------------------------
// Trust Workflow: Instruments (Promissory Note + Security Agreement)
// -----------------------------

export const workflowPromissoryNotes = mysqlTable("workflow_promissory_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  certificateId: varchar("certificateId", { length: 36 }).notNull(),

  noteNumber: varchar("noteNumber", { length: 80 }).notNull().unique(), // "PN-{TID}-2026-0001"
  issuerName: varchar("issuerName", { length: 255 }).notNull(),
  principalAmountCents: int("principalAmountCents").notNull(),
  interestRateBps: int("interestRateBps"), // optional
  paymentTerms: text("paymentTerms").notNull(),
  maturityDate: varchar("maturityDate", { length: 24 }).notNull(),
  governingLawState: varchar("governingLawState", { length: 10 }),

  trustDocumentId: varchar("trustDocumentId", { length: 36 }),

  createdAt: timestamp("createdAt").defaultNow(),
});

export const workflowSecurityAgreements = mysqlTable("workflow_security_agreements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),
  certificateId: varchar("certificateId", { length: 36 }).notNull(),
  noteId: varchar("noteId", { length: 36 }), // nullable

  agreementNumber: varchar("agreementNumber", { length: 80 }).notNull().unique(), // "SA-{TID}-2026-0001"
  debtorName: varchar("debtorName", { length: 255 }).notNull(),
  collateralDescription: text("collateralDescription").notNull(),
  governingLawState: varchar("governingLawState", { length: 10 }),

  trustDocumentId: varchar("trustDocumentId", { length: 36 }),

  createdAt: timestamp("createdAt").defaultNow(),
});

// -----------------------------
// Trust Workflow: Presentation Packages (Pitch Deck + PPM link)
// -----------------------------

export const workflowPresentationPackages = mysqlTable("workflow_presentation_packages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  trustId: varchar("trustId", { length: 36 }).notNull(),

  packageNumber: varchar("packageNumber", { length: 80 }).notNull().unique(), // "PKG-{TID}-2026-0001"
  status: mysqlEnum("status", ["draft", "ready_for_review", "approved", "archived"]).default("draft"),

  includedJson: text("includedJson").notNull(), // { certificateIds:[], noteIds:[], agreementIds:[], offeringId?:... }
  pitchDeckTrustDocumentId: varchar("pitchDeckTrustDocumentId", { length: 36 }),
  offeringId: varchar("offeringId", { length: 36 }), // link into security_offerings (optional)

  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// -----------------------------
// Governance: Trust Protector & Entity Governance Assignments
// -----------------------------

export const governanceAssignments = mysqlTable("governance_assignments", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  entityType: mysqlEnum("entityType", ["trust", "family_office", "foundation", "dao_wrapper"]).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(), // UUID of the entity
  clientProfileId: varchar("clientProfileId", { length: 36 }).notNull(), // FK to workflowClientProfiles

  role: mysqlEnum("role", ["trustee", "trust_protector", "committee_member", "counsel_reviewer"]).notNull(),
  powersJson: text("powersJson").notNull(), // JSON array of granted powers
  triggersJson: text("triggersJson"), // JSON object of activation conditions

  status: mysqlEnum("status", ["active", "inactive", "pending_approval"]).default("active").notNull(),

  assignedBy: int("assignedBy").notNull(), // userId who assigned this role
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  activatedAt: timestamp("activatedAt"), // when triggers activated the role

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// -----------------------------
// Trust Workflow: Type Exports
// -----------------------------

export type WorkflowSequenceRow = typeof workflowSequences.$inferSelect;
export type InsertWorkflowSequenceRow = typeof workflowSequences.$inferInsert;
export type WorkflowClientProfileRow = typeof workflowClientProfiles.$inferSelect;
export type InsertWorkflowClientProfileRow = typeof workflowClientProfiles.$inferInsert;
export type WorkflowTrustAssetRow = typeof workflowTrustAssets.$inferSelect;
export type InsertWorkflowTrustAssetRow = typeof workflowTrustAssets.$inferInsert;
export type WorkflowAssetCertificateRow = typeof workflowAssetCertificates.$inferSelect;
export type InsertWorkflowAssetCertificateRow = typeof workflowAssetCertificates.$inferInsert;
export type WorkflowPromissoryNoteRow = typeof workflowPromissoryNotes.$inferSelect;
export type InsertWorkflowPromissoryNoteRow = typeof workflowPromissoryNotes.$inferInsert;
export type WorkflowSecurityAgreementRow = typeof workflowSecurityAgreements.$inferSelect;
export type InsertWorkflowSecurityAgreementRow = typeof workflowSecurityAgreements.$inferInsert;
export type WorkflowPresentationPackageRow = typeof workflowPresentationPackages.$inferSelect;
export type InsertWorkflowPresentationPackageRow = typeof workflowPresentationPackages.$inferInsert;
export type GovernanceAssignmentRow = typeof governanceAssignments.$inferSelect;
export type InsertGovernanceAssignmentRow = typeof governanceAssignments.$inferInsert;

