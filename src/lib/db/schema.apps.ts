// src/lib/db/schema.apps.ts
// Creator / Developer Marketplace: platform_apps, user_installed_apps
import {
  mysqlTable,
  mysqlEnum,
  int,
  varchar,
  text,
  timestamp,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// -----------------------------
// Platform Apps (creator marketplace catalog)
// -----------------------------
export const platformApps = mysqlTable(
  "platform_apps",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 60 }).notNull(),
    creatorId: int("creatorId").notNull(),
    version: int("version").default(1).notNull(),
    priceToken: int("priceToken"),
    priceUSD: int("priceUSD"),
    revenueShare: int("revenueShare"),
    installCount: int("installCount").default(0).notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    manifestJson: json("manifestJson"),
    capabilitiesJson: json("capabilitiesJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUidx: uniqueIndex("platform_apps_slug_uidx").on(table.slug),
    creatorIdx: index("platform_apps_creator_idx").on(table.creatorId),
    categoryIdx: index("platform_apps_category_idx").on(table.category),
    statusIdx: index("platform_apps_status_idx").on(table.status),
  })
);

// -----------------------------
// User Installed Apps
// -----------------------------
export const userInstalledApps = mysqlTable(
  "user_installed_apps",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    appId: varchar("appId", { length: 36 }).notNull(),
    installedAt: timestamp("installedAt").defaultNow().notNull(),
    scope: mysqlEnum("scope", ["world", "entity", "dashboard", "agent"]).notNull(),
    worldId: varchar("worldId", { length: 36 }),
    entityId: varchar("entityId", { length: 36 }),
    agentId: varchar("agentId", { length: 80 }),
    configJson: json("configJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_installed_apps_user_idx").on(table.userId),
    appIdx: index("user_installed_apps_app_idx").on(table.appId),
    scopeIdx: index("user_installed_apps_scope_idx").on(table.scope),
    userAppIdx: index("user_installed_apps_user_app_idx").on(table.userId, table.appId),
  })
);
