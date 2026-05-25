/**
 * Drizzle tables for merch, Revenue OS analyze persistence, and RET sessions.
 * Physical schema matches `drizzle/0001_add_marketplace_phone.sql` and `drizzle/ret_sessions.sql`.
 */
import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const retSessions = mysqlTable("ret_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  draftJson: text("draftJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const revenueProfiles = mysqlTable("revenue_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }),
  trustId: varchar("trust_id", { length: 36 }),
  walletAddress: varchar("walletAddress", { length: 64 }),
  businessName: varchar("businessName", { length: 160 }),
  businessType: varchar("businessType", { length: 120 }),
  market: varchar("market", { length: 120 }),
  currentMonthlyRevenue: decimal("currentMonthlyRevenue", { precision: 18, scale: 2 }).notNull(),
  targetMonthlyRevenue: decimal("targetMonthlyRevenue", { precision: 18, scale: 2 }).notNull(),
  avgOrderValue: decimal("avgOrderValue", { precision: 18, scale: 2 }).notNull(),
  grossMarginPct: decimal("grossMarginPct", { precision: 5, scale: 2 }).notNull(),
  monthlyTraffic: int("monthlyTraffic").notNull(),
  conversionRatePct: decimal("conversionRatePct", { precision: 6, scale: 3 }).notNull(),
  cac: decimal("cac", { precision: 18, scale: 2 }).notNull(),
  ltv: decimal("ltv", { precision: 18, scale: 2 }).notNull(),
  constraints: json("constraints").$type<Record<string, unknown> | null>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsRuns = mysqlTable("revenue_os_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }),
  trustId: varchar("trust_id", { length: 36 }),
  profileId: varchar("profileId", { length: 36 }).notNull(),
  input: json("input").notNull().$type<Record<string, unknown>>(),
  output: json("output").notNull().$type<Record<string, unknown>>(),
  inputHash: varchar("inputHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const merchProjects = mysqlTable("merch_projects", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  lane: mysqlEnum("lane", ["CREATE", "STUDIO"]).notNull().default("CREATE"),
  name: varchar("name", { length: 191 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const merchVersions = mysqlTable("merch_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull(),
  kind: mysqlEnum("kind", ["GENERATE", "INPAINT", "VARIANT"]).notNull().default("GENERATE"),
  prompt: text("prompt"),
  negativePrompt: text("negativePrompt"),
  seed: int("seed"),
  modelVersion: varchar("modelVersion", { length: 120 }),
  paramsJson: json("paramsJson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const merchRenders = mysqlTable("merch_renders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  versionId: varchar("versionId", { length: 36 }).notNull(),
  kind: mysqlEnum("kind", ["MOCKUP_FRONT", "MOCKUP_BACK", "FLAT", "LIFESTYLE"]).notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  url: text("url").notNull(),
  metadataJson: json("metadataJson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const merchAssets = mysqlTable("merch_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["GARMENT_TEMPLATE", "LOGO", "REFERENCE", "BRAND_KIT", "MASK"]).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  url: text("url").notNull(),
  metadataJson: json("metadataJson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const merchOrders = mysqlTable("merch_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  projectId: varchar("projectId", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"]).notNull().default("DRAFT"),
  itemsJson: json("itemsJson").$type<Record<string, unknown> | null>(),
  totalCents: int("totalCents").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const merchExports = mysqlTable("merch_exports", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull(),
  type: mysqlEnum("type", ["MOCKUP_PACK_ZIP", "TECHPACK_PDF"]).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
