// src/lib/db/schema.worlds.ts
// Multi-tenant world architecture: worlds, platform zones, asset marketplace, reserved zones
// See docs/MULTI_TENANT_WORLD_ARCHITECTURE_SPEC.md
import {
  mysqlTable,
  mysqlEnum,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  json,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// -----------------------------
// 1. Worlds
// -----------------------------
export const worlds = mysqlTable(
  "worlds",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    workspaceId: varchar("workspaceId", { length: 36 }),
    ownerWallet: varchar("ownerWallet", { length: 42 }),
    nftContractAddress: varchar("nftContractAddress", { length: 42 }),
    nftTokenId: varchar("nftTokenId", { length: 80 }),
    saleStatus: mysqlEnum("saleStatus", ["not_listed", "listed", "sold"]),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    visibility: mysqlEnum("visibility", ["private", "public", "unlisted", "token_gated"])
      .default("private")
      .notNull(),
    terrainSeed: int("terrainSeed").default(42).notNull(),
    biomeType: varchar("biomeType", { length: 40 }).default("green-terrain").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("worlds_owner_idx").on(table.ownerId),
    ownerWalletIdx: index("worlds_owner_wallet_idx").on(table.ownerWallet),
    visibilityIdx: index("worlds_visibility_idx").on(table.visibility),
    statusIdx: index("worlds_status_idx").on(table.status),
  })
);

// -----------------------------
// 2. World Versions (draft / published)
// -----------------------------
export const worldVersions = mysqlTable(
  "world_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }).notNull(),
    versionType: mysqlEnum("versionType", ["draft", "published"]).notNull(),
    versionNumber: int("versionNumber").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("world_versions_world_idx").on(table.worldId),
    worldTypeIdx: index("world_versions_world_type_idx").on(table.worldId, table.versionType),
  })
);

// -----------------------------
// 3. World Chunk Placements
// -----------------------------
export const worldChunkPlacements = mysqlTable(
  "world_chunk_placements",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldVersionId: varchar("worldVersionId", { length: 36 }).notNull(),
    chunkKey: varchar("chunkKey", { length: 20 }).notNull(),
    placementsJson: json("placementsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldVersionIdx: index("world_chunk_placements_version_idx").on(table.worldVersionId),
    chunkIdx: index("world_chunk_placements_chunk_idx").on(table.worldVersionId, table.chunkKey),
  })
);

// -----------------------------
// 4. Platform Global Zones (multiple zones)
// -----------------------------
export const platformGlobalZones = mysqlTable(
  "platform_global_zones",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    boundsJson: json("boundsJson").notNull(),
    placementsJson: json("placementsJson").notNull(),
    npcsJson: json("npcsJson"),
    isActive: boolean("isActive").default(true).notNull(),
    priority: int("priority").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUidx: uniqueIndex("platform_global_zones_slug_uidx").on(table.slug),
    activeIdx: index("platform_global_zones_active_idx").on(table.isActive),
  })
);

// -----------------------------
// 5. Platform Global Zone Versions
// -----------------------------
export const platformGlobalZoneVersions = mysqlTable(
  "platform_global_zone_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    zoneId: varchar("zoneId", { length: 36 }).notNull(),
    versionNumber: int("versionNumber").notNull(),
    versionType: mysqlEnum("versionType", ["draft", "published"]).notNull(),
    placementsJson: json("placementsJson").notNull(),
    npcsJson: json("npcsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    zoneIdx: index("platform_global_zone_versions_zone_idx").on(table.zoneId),
    zoneTypeIdx: index("platform_global_zone_versions_zone_type_idx").on(
      table.zoneId,
      table.versionType
    ),
  })
);

// -----------------------------
// 6. World Reserved Zones
// -----------------------------
export const worldReservedZones = mysqlTable(
  "world_reserved_zones",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }),
    zoneType: mysqlEnum("zoneType", ["platform", "system", "road", "spawn"]).notNull(),
    boundsJson: json("boundsJson").notNull(),
    sourceZoneId: varchar("sourceZoneId", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("world_reserved_zones_world_idx").on(table.worldId),
    typeIdx: index("world_reserved_zones_type_idx").on(table.zoneType),
  })
);

// -----------------------------
// 7. World Library Assets
// -----------------------------
export const worldLibraryAssets = mysqlTable(
  "world_library_assets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    version: int("version").default(1).notNull(),
    modelUrl: varchar("modelUrl", { length: 512 }).notNull(),
    previewImageUrl: varchar("previewImageUrl", { length: 512 }),
    manifestUrl: varchar("manifestUrl", { length: 512 }),
    collisionType: mysqlEnum("collisionType", ["none", "box", "capsule", "hull"])
      .default("box")
      .notNull(),
    instancable: boolean("instancable").default(false).notNull(),
    lodProfile: varchar("lodProfile", { length: 40 }),
    boundsJson: json("boundsJson"),
    tokenPrice: int("tokenPrice").default(0).notNull(),
    supplyLimit: int("supplyLimit"),
    isPlatformOnly: boolean("isPlatformOnly").default(false).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    metadataJson: json("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUidx: uniqueIndex("world_library_assets_slug_uidx").on(table.slug),
    categoryIdx: index("world_library_assets_category_idx").on(table.category),
    statusIdx: index("world_library_assets_status_idx").on(table.status),
    activeIdx: index("world_library_assets_active_idx").on(table.isActive),
  })
);

// -----------------------------
// 8. User World Assets (ownership)
// -----------------------------
export const userWorldAssets = mysqlTable(
  "user_world_assets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    workspaceId: varchar("workspaceId", { length: 36 }),
    assetId: varchar("assetId", { length: 36 }).notNull(),
    licenseScope: mysqlEnum("licenseScope", [
      "all_worlds_owned",
      "one_world",
      "quantity_based",
    ])
      .default("all_worlds_owned")
      .notNull(),
    remainingPlacements: int("remainingPlacements"),
    purchaseTx: varchar("purchaseTx", { length: 128 }),
    purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_world_assets_user_idx").on(table.userId),
    assetIdx: index("user_world_assets_asset_idx").on(table.assetId),
  })
);

// -----------------------------
// 9. World NPCs
// -----------------------------
export const worldNpcs = mysqlTable(
  "world_npcs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }).notNull(),
    agentId: varchar("agentId", { length: 80 }).notNull(),
    buildingId: varchar("buildingId", { length: 36 }),
    placementJson: json("placementJson").notNull(),
    role: varchar("role", { length: 80 }),
    voiceProfile: varchar("voiceProfile", { length: 80 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("world_npcs_world_idx").on(table.worldId),
  })
);

// -----------------------------
// 10. World Commerce Nodes
// -----------------------------
export const worldCommerceNodes = mysqlTable(
  "world_commerce_nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }).notNull(),
    ownerId: int("ownerId").notNull(),
    nodeType: mysqlEnum("nodeType", [
      "store",
      "service",
      "consultation",
      "ad_space",
      "product_display",
      "event_space",
      "course",
      "npc_service",
    ]).notNull(),
    placementJson: json("placementJson").notNull(),
    assetId: varchar("assetId", { length: 36 }),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    agentId: varchar("agentId", { length: 80 }),
    entityId: varchar("entityId", { length: 36 }),
    priceToken: int("priceToken"),
    priceUSD: int("priceUSD"),
    revenueShare: int("revenueShare"),
    status: mysqlEnum("status", ["draft", "active", "paused", "archived"])
      .default("active")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("world_commerce_nodes_world_idx").on(table.worldId),
    ownerIdx: index("world_commerce_nodes_owner_idx").on(table.ownerId),
    nodeTypeIdx: index("world_commerce_nodes_type_idx").on(table.nodeType),
    statusIdx: index("world_commerce_nodes_status_idx").on(table.status),
  })
);

// -----------------------------
// 11. Commerce Transactions
// -----------------------------
export const commerceTransactions = mysqlTable(
  "commerce_transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }).notNull(),
    nodeId: varchar("nodeId", { length: 36 }).notNull(),
    payerId: int("payerId").notNull(),
    payeeId: int("payeeId").notNull(),
    amountToken: int("amountToken"),
    amountUSD: int("amountUSD"),
    platformFeeToken: int("platformFeeToken"),
    platformFeeUSD: int("platformFeeUSD"),
    ownerAmountToken: int("ownerAmountToken"),
    ownerAmountUSD: int("ownerAmountUSD"),
    currency: mysqlEnum("currency", ["token", "usd", "both"]).default("token").notNull(),
    status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"])
      .default("completed")
      .notNull(),
    txRef: varchar("txRef", { length: 128 }),
    metadataJson: json("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("commerce_transactions_world_idx").on(table.worldId),
    nodeIdx: index("commerce_transactions_node_idx").on(table.nodeId),
    payerIdx: index("commerce_transactions_payer_idx").on(table.payerId),
    payeeIdx: index("commerce_transactions_payee_idx").on(table.payeeId),
    statusIdx: index("commerce_transactions_status_idx").on(table.status),
  })
);

// -----------------------------
// 12. Platform Ad Slots
// -----------------------------
export const platformAdSlots = mysqlTable(
  "platform_ad_slots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    zoneId: varchar("zoneId", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    placementJson: json("placementJson").notNull(),
    adType: mysqlEnum("adType", [
      "billboard",
      "video",
      "kiosk",
      "npc_sponsor",
      "banner",
    ]).notNull(),
    priceToken: int("priceToken"),
    currentAdvertiser: varchar("currentAdvertiser", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    zoneIdx: index("platform_ad_slots_zone_idx").on(table.zoneId),
  })
);

// -----------------------------
// 13. Platform Agents (Agent Network catalog)
// -----------------------------
export const platformAgents = mysqlTable(
  "platform_agents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    capabilities: json("capabilities"),
    priceToken: int("priceToken").default(0),
    priceUSD: int("priceUSD").default(0),
    creatorId: int("creatorId"),
    status: mysqlEnum("status", ["draft", "published", "archived"])
      .default("published")
      .notNull(),
    metadataJson: json("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUidx: uniqueIndex("platform_agents_slug_uidx").on(table.slug),
    statusIdx: index("platform_agents_status_idx").on(table.status),
    creatorIdx: index("platform_agents_creator_idx").on(table.creatorId),
  })
);

// -----------------------------
// 14. Venue Interior Nodes (interaction nodes inside placed venue GLBs)
// -----------------------------
export const venueInteriorNodes = mysqlTable(
  "venue_interior_nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    worldId: varchar("worldId", { length: 36 }).notNull(),
    placementId: varchar("placementId", { length: 64 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }),
    nodeType: varchar("nodeType", { length: 40 }).default("voice_room").notNull(),
    description: text("description"),
    posX: decimal("posX", { precision: 12, scale: 4 }).default("0").notNull(),
    posY: decimal("posY", { precision: 12, scale: 4 }).default("0").notNull(),
    posZ: decimal("posZ", { precision: 12, scale: 4 }).default("0").notNull(),
    rotY: decimal("rotY", { precision: 12, scale: 4 }).default("0").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    accessType: varchar("accessType", { length: 24 }).default("public").notNull(),
    roomId: varchar("roomId", { length: 120 }).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    worldIdx: index("venue_interior_nodes_world_idx").on(table.worldId),
    placementIdx: index("venue_interior_nodes_placement_idx").on(table.worldId, table.placementId),
    roomIdx: index("venue_interior_nodes_room_idx").on(table.roomId),
    roomUidx: uniqueIndex("venue_interior_nodes_room_uidx").on(table.roomId),
  })
);

// -----------------------------
// 15. World Links (network connectivity)
// -----------------------------
export const worldLinks = mysqlTable(
  "world_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    fromWorldId: varchar("fromWorldId", { length: 36 }).notNull(),
    toWorldId: varchar("toWorldId", { length: 36 }).notNull(),
    label: varchar("label", { length: 120 }),
    placementJson: json("placementJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    fromIdx: index("world_links_from_idx").on(table.fromWorldId),
    toIdx: index("world_links_to_idx").on(table.toWorldId),
  })
);
