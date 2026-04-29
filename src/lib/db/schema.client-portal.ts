import { int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const clientPortalUsers = mysqlTable("client_portal_users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  ownerUserId: int("ownerUserId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: varchar("role", { length: 16 }).notNull().default("viewer"),
  status: varchar("status", { length: 16 }).notNull().default("invited"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientPortalInvites = mysqlTable("client_portal_invites", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  ownerUserId: int("ownerUserId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("manager"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clientServiceStatus = mysqlTable("client_service_status", {
  clientId: varchar("clientId", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  pauseReason: varchar("pauseReason", { length: 512 }),
  pausedAt: timestamp("pausedAt"),
  resumedAt: timestamp("resumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientPortalActivityLog = mysqlTable("client_portal_activity_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  portalUserId: varchar("portalUserId", { length: 36 }),
  action: varchar("action", { length: 64 }).notNull(),
  payloadJson: json("payloadJson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt", { fsp: 3 }).defaultNow().notNull(),
});

export const clientPortalRequests = mysqlTable("client_portal_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("clientId", { length: 36 }).notNull(),
  portalUserId: varchar("portalUserId", { length: 36 }),
  ownerUserId: int("ownerUserId").notNull(),
  type: varchar("type", { length: 32 }).notNull().default("other"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  relatedConversationId: varchar("relatedConversationId", { length: 36 }),
  relatedAgentId: varchar("relatedAgentId", { length: 36 }),
  relatedSiteId: varchar("relatedSiteId", { length: 36 }),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  operatorNote: text("operatorNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
