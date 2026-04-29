/**
 * Property Twin — digital twin planning, assets, reconstruction jobs, and node graph.
 *
 * Table names: `property_twin_properties`, `property_twin_assets`, `property_twin_jobs`, `property_twin_nodes`.
 */
import {
  double,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";
import type { ReconstructionJobResult } from "./types";

export const ptProperties = mysqlTable("property_twin_properties", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }),
  description: text("description"),
  ownerWallet: varchar("ownerWallet", { length: 128 }),
  /** Logged-in owner; use for access control. Legacy rows may be null until backfilled. */
  ownerUserId: int("ownerUserId"),
  /** Read-only presentation access without login; unique when set. */
  publicShareToken: varchar("publicShareToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ptAssetKind = ["exterior", "interior", "landscape", "video", "floor_plan"] as const;

export const propertyTwinAssets = mysqlTable("property_twin_assets", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  kind: mysqlEnum("kind", ptAssetKind).notNull(),
  /** Public URL path e.g. /uploads/property-twin/1/uuid.jpg */
  url: varchar("url", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  originalFilename: varchar("originalFilename", { length: 512 }),
  bytes: int("bytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ptJobMode = [
  "photogrammetry",
  "gaussian",
  "neural",
  "hybrid",
  "manual",
] as const;

export const ptJobStatus = [
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export const propertyTwinJobs = mysqlTable("property_twin_jobs", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  mode: mysqlEnum("mode", ptJobMode).notNull().default("photogrammetry"),
  status: mysqlEnum("status", ptJobStatus).notNull().default("draft"),
  progress: int("progress").default(0).notNull(),
  errorMessage: text("errorMessage"),
  /** Asset IDs driving this job */
  inputAssetIds: json("inputAssetIds").$type<number[]>(),
  outputUrl: varchar("outputUrl", { length: 1024 }),
  /** Full reconstruction result (format, anchors, warnings). `outputUrl` duplicated for simple queries. */
  resultJson: json("resultJson").$type<ReconstructionJobResult | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const propertyTwinNodes = mysqlTable("property_twin_nodes", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  zone: varchar("zone", { length: 64 }).notNull().default("general"),
  label: varchar("label", { length: 256 }).notNull(),
  nodeType: varchar("nodeType", { length: 64 }).notNull().default("planning"),
  sortOrder: int("sortOrder").default(0).notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  /** Scene anchor in viewer/world space (twin mesh coordinates). */
  anchorX: double("anchorX"),
  anchorY: double("anchorY"),
  anchorZ: double("anchorZ"),
  /** USD whole dollars — optional per-node ROI modeling. */
  estimatedCost: int("estimatedCost"),
  estimatedValueLift: int("estimatedValueLift"),
  roiPercent: int("roiPercent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PtPropertyRow = typeof ptProperties.$inferSelect;
export type PtAssetRow = typeof propertyTwinAssets.$inferSelect;
export type PtJobRow = typeof propertyTwinJobs.$inferSelect;
export type PtNodeRow = typeof propertyTwinNodes.$inferSelect;
