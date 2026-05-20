/**
 * Site Builder paid fulfillment slice — `drizzle/0129_site_builder_fulfillment.sql`.
 * WEBSITE / site_builder only in v1; no Bentley, Trust, Content360, or deploy automation.
 */

import { boolean, int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Claude worker desk API keys (`hf_cwd_*`); separate from `developer_api_keys` and admin JWT. */
export const claudeWorkerApiKeys = mysqlTable("claude_worker_api_keys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerAdminUserId: int("ownerAdminUserId").notNull(),
  createdByAdminUserId: int("createdByAdminUserId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 24 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  scopesJson: text("scopesJson").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  revokedAt: timestamp("revokedAt"),
  expiresAt: timestamp("expiresAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const paymentConfirmations = mysqlTable("payment_confirmations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }),
  marketplaceUserId: int("marketplaceUserId"),
  provider: varchar("provider", { length: 32 }).notNull(),
  externalRef: varchar("externalRef", { length: 191 }),
  amountCents: int("amountCents"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  status: mysqlEnum("status", ["pending", "confirmed", "failed"]).notNull().default("pending"),
  confirmedAt: timestamp("confirmedAt"),
  confirmedByAdminUserId: int("confirmedByAdminUserId"),
  evidenceJson: longtext("evidenceJson"),
  consumedAt: timestamp("consumedAt"),
  consumedByOrderId: varchar("consumedByOrderId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Paid service order spine; v1 primary service is WEBSITE only at the application layer. */
export const clientServiceOrders = mysqlTable("client_service_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  marketplaceUserId: int("marketplaceUserId"),
  primaryService: varchar("primaryService", { length: 32 }).notNull(),
  requestedServicesJson: text("requestedServicesJson"),
  pipelineStage: varchar("pipelineStage", { length: 64 }).notNull(),
  paymentConfirmationId: varchar("paymentConfirmationId", { length: 36 }).notNull(),
  assignedDepartment: varchar("assignedDepartment", { length: 32 }).notNull(),
  salesSummaryText: text("salesSummaryText"),
  consentJson: text("consentJson"),
  requestedDeliverableJson: text("requestedDeliverableJson"),
  executiveHandoffJson: longtext("executiveHandoffJson"),
  source: varchar("source", { length: 32 }).notNull(),
  claudeWorkerApiKeyId: varchar("claudeWorkerApiKeyId", { length: 36 }),
  ownerAdminUserId: int("ownerAdminUserId").notNull(),
  claudeIdempotencyKey: varchar("claudeIdempotencyKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable audit trail for fulfillment order stage transitions. */
export const clientServiceOrderEvents = mysqlTable("client_service_order_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("orderId", { length: 36 }).notNull(),
  actorType: varchar("actorType", { length: 32 }).notNull(),
  actorId: varchar("actorId", { length: 191 }),
  fromStage: varchar("fromStage", { length: 64 }),
  toStage: varchar("toStage", { length: 64 }).notNull(),
  payloadJson: longtext("payloadJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** One deliverable shell per order; Site Builder draft routing attaches `artifactRef` later. */
export const fulfillmentDeliverables = mysqlTable("fulfillment_deliverables", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("orderId", { length: 36 }).notNull(),
  department: varchar("department", { length: 32 }).notNull(),
  artifactType: varchar("artifactType", { length: 64 }).notNull(),
  artifactRef: varchar("artifactRef", { length: 191 }),
  ownerReviewStatus: mysqlEnum("ownerReviewStatus", ["pending", "approved", "rejected"])
    .notNull()
    .default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
