## OASIS DB Models – Reference (Mongoose & Drizzle)

> This is a reference-only file with example schemas/interfaces for both MongoDB
> (Mongoose) and PostgreSQL (Drizzle). It is **not imported** into the runtime
> build. Use it as a guide when wiring persistence for 3D assets, rooms, and
> wallet stats.

```ts
// ============================================================================
// DATABASE ORM MODELS - Mongoose & Drizzle Examples
// ============================================================================

// =============================================================================
// MONGOOSE MODELS (MongoDB)
// =============================================================================

// Note: this snippet assumes mongoose is installed in the target service.
// It is provided here for reference and is not part of the Next.js build.

import mongoose, { Schema, Document } from "mongoose";

// ============================================================================
// 1. ASSET MODEL
// ============================================================================

interface IAsset extends Document {
  id: string;
  assetId: string;
  assetType: "furniture" | "electronics" | "decoration" | "fixture" | "custom";
  assetName: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  properties: Record<string, any>;
  displayName?: string;
  displayDescription?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy?: string;
  tags: string[];
  isVisible: boolean;
  isLocked: boolean;
  isInteractable: boolean;
  interactionZone?: {
    id: string;
    position: { x: number; y: number; z: number };
    radius: number;
    type: string;
    targetId?: string;
    prompt?: string;
    action?: string;
  };
  canSit?: boolean;
  canPickup?: boolean;
  canUse?: boolean;
  isForSale?: boolean;
  price?: number;
  currency?: string;
  stock?: number;
  modelUrl?: string;
  imageUrl?: string;
  buildingId: string;
  roomId?: string;
  editHistory: Array<{
    signature: string;
    changedFields: string[];
    timestamp: Date;
    walletAddress: string;
    ipfsHash?: string;
    transactionHash?: string;
  }>;
}

const assetSchema = new Schema<IAsset>(
  {
    id: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, required: true, index: true },
    assetType: {
      type: String,
      enum: ["furniture", "electronics", "decoration", "fixture", "custom"],
      required: true,
    },
    assetName: { type: String, required: true, minlength: 1, maxlength: 255 },
    position: { x: { type: Number, required: true }, y: { type: Number, required: true }, z: { type: Number, required: true } },
    rotation: { x: { type: Number, required: true }, y: { type: Number, required: true }, z: { type: Number, required: true } },
    scale: { x: { type: Number, required: true, min: 0.1 }, y: { type: Number, required: true, min: 0.1 }, z: { type: Number, required: true, min: 0.1 } },
    properties: { type: Schema.Types.Mixed, default: {} },
    displayName: String,
    displayDescription: String,
    createdBy: { type: String, required: true, index: true },
    lastModifiedBy: String,
    tags: [String],
    isVisible: { type: Boolean, default: true, index: true },
    isLocked: { type: Boolean, default: false },
    isInteractable: { type: Boolean, default: true },
    interactionZone: {
      id: String,
      position: { x: Number, y: Number, z: Number },
      radius: Number,
      type: String,
      targetId: String,
      prompt: String,
      action: String,
    },
    canSit: Boolean,
    canPickup: Boolean,
    canUse: Boolean,
    isForSale: { type: Boolean, default: false, index: true },
    price: { type: Number, min: 0 },
    currency: String,
    stock: { type: Number, min: 0 },
    modelUrl: String,
    imageUrl: String,
    buildingId: { type: String, required: true, index: true },
    roomId: { type: String, index: true },
    editHistory: [
      {
        signature: String,
        changedFields: [String],
        timestamp: Date,
        walletAddress: String,
        ipfsHash: String,
        transactionHash: String,
      },
    ],
  },
  { timestamps: true }
);

assetSchema.index({ buildingId: 1, isVisible: 1, createdAt: -1 });
assetSchema.index({ createdBy: 1, createdAt: -1 });
assetSchema.index({ assetId: 1 });
assetSchema.index({ assetName: "text", displayDescription: "text" });

export const Asset = mongoose.model<IAsset>("Asset", assetSchema);

// ============================================================================
// 2. ROOM COLORS MODEL
// ============================================================================

interface IRoomColors extends Document {
  roomId: string;
  buildingId: string;
  colors: {
    walls: string;
    ceiling: string;
    floor: string;
    windows: string;
    windowFrames: string;
    doors: string;
    doorFrames: string;
    railings: string;
    ambientLightColor: string;
    ambientLightIntensity: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy?: string;
  colorHistory: Array<{
    colors: Record<string, any>;
    changedAt: Date;
    changedBy: string;
    signature: string;
    ipfsHash?: string;
  }>;
  presetName?: string;
  isSavedPreset: boolean;
}

const roomColorsSchema = new Schema<IRoomColors>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    buildingId: { type: String, required: true, index: true },
    colors: {
      walls: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      ceiling: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      floor: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      windows: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      windowFrames: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      doors: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      doorFrames: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      railings: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      ambientLightColor: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
      ambientLightIntensity: { type: Number, required: true, min: 0, max: 1 },
    },
    createdBy: { type: String, required: true, index: true },
    lastModifiedBy: String,
    colorHistory: [
      { colors: Schema.Types.Mixed, changedAt: Date, changedBy: String, signature: String, ipfsHash: String },
    ],
    presetName: String,
    isSavedPreset: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomColorsSchema.index({ buildingId: 1 });
roomColorsSchema.index({ createdBy: 1 });
roomColorsSchema.index({ updatedAt: -1 });

export const RoomColors = mongoose.model<IRoomColors>("RoomColors", roomColorsSchema);

// ============================================================================
// 3. EDIT HISTORY MODEL
// ============================================================================

interface IEditHistory extends Document {
  id: string;
  entityId: string;
  entityType: "asset" | "room_colors";
  buildingId: string;
  editedBy: string;
  editedAt: Date;
  changedFields: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  signature: string;
  signatureValid: boolean;
  ipfsHash?: string;
  transactionHash?: string;
}

const editHistorySchema = new Schema<IEditHistory>(
  {
    id: { type: String, required: true, unique: true },
    entityId: { type: String, required: true, index: true },
    entityType: { type: String, enum: ["asset", "room_colors"], required: true, index: true },
    buildingId: { type: String, required: true, index: true },
    editedBy: { type: String, required: true, index: true },
    editedAt: { type: Date, default: Date.now, index: -1 },
    changedFields: [String],
    previousValues: Schema.Types.Mixed,
    newValues: Schema.Types.Mixed,
    signature: { type: String, required: true },
    signatureValid: { type: Boolean, default: true },
    ipfsHash: String,
    transactionHash: String,
  },
  { timestamps: false }
);

editHistorySchema.index({ entityId: 1, editedAt: -1 });
editHistorySchema.index({ editedBy: 1, editedAt: -1 });

export const EditHistory = mongoose.model<IEditHistory>("EditHistory", editHistorySchema);

// ============================================================================
// 4. BUILDING MODEL
// ============================================================================

interface IBuilding extends Document {
  id: string;
  name: string;
  type: "store" | "home" | "office" | "custom";
  owner: string;
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  rooms: string[];
  description?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const buildingSchema = new Schema<IBuilding>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, minlength: 1, maxlength: 255 },
    type: { type: String, enum: ["store", "home", "office", "custom"] },
    owner: { type: String, required: true, index: true },
    position: { x: Number, y: Number, z: Number },
    size: { x: Number, y: Number, z: Number },
    rooms: [String],
    description: String,
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

buildingSchema.index({ owner: 1 });
buildingSchema.index({ type: 1 });

export const Building = mongoose.model<IBuilding>("Building", buildingSchema);

// ============================================================================
// 5. WALLET STATS MODEL
// ============================================================================

interface IWalletStats extends Document {
  walletAddress: string;
  assetsCreated: number;
  assetsEdited: number;
  totalEdits: number;
  firstSeen: Date;
  lastSeen: Date;
  reputation: number;
  verifiedEdits: number;
  transactionCount: number;
  totalSpent: number;
}

const walletStatsSchema = new Schema<IWalletStats>(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    assetsCreated: { type: Number, default: 0, min: 0 },
    assetsEdited: { type: Number, default: 0, min: 0 },
    totalEdits: { type: Number, default: 0, min: 0 },
    firstSeen: Date,
    lastSeen: Date,
    reputation: { type: Number, default: 0, min: 0, max: 100, index: -1 },
    verifiedEdits: { type: Number, default: 0, min: 0 },
    transactionCount: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false }
);

walletStatsSchema.index({ reputation: -1 });
walletStatsSchema.index({ lastSeen: -1 });
walletStatsSchema.index({ totalEdits: -1 });

export const WalletStats = mongoose.model<IWalletStats>("WalletStats", walletStatsSchema);

// =============================================================================
// DRIZZLE ORM MODELS (PostgreSQL)
// =============================================================================

// Note: These are examples; integrate into your Drizzle schema as needed.

import {
  pgTable,
  text,
  varchar,
  uuid,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

// ============================================================================
// 1. BUILDINGS TABLE
// ============================================================================

export const buildings = pgTable(
  "buildings",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }),
    owner: varchar("owner", { length: 42 }).notNull(),
    positionX: doublePrecision("position_x"),
    positionY: doublePrecision("position_y"),
    positionZ: doublePrecision("position_z"),
    sizeX: doublePrecision("size_x"),
    sizeY: doublePrecision("size_y"),
    sizeZ: doublePrecision("size_z"),
    description: text("description"),
    isPublic: boolean("is_public").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("idx_buildings_owner").on(table.owner),
    typeIdx: index("idx_buildings_type").on(table.type),
    createdAtIdx: index("idx_buildings_created_at").on(table.createdAt),
  })
);

// ============================================================================
// 2. ASSETS TABLE
// ============================================================================

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: varchar("asset_id", { length: 255 }).notNull(),
    assetType: varchar("asset_type", { length: 50 }).notNull(),
    assetName: varchar("asset_name", { length: 255 }).notNull(),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
    positionZ: doublePrecision("position_z").notNull(),
    rotationX: doublePrecision("rotation_x").notNull(),
    rotationY: doublePrecision("rotation_y").notNull(),
    rotationZ: doublePrecision("rotation_z").notNull(),
    scaleX: doublePrecision("scale_x").notNull(),
    scaleY: doublePrecision("scale_y").notNull(),
    scaleZ: doublePrecision("scale_z").notNull(),
    properties: jsonb("properties"),
    displayName: varchar("display_name", { length: 255 }),
    displayDescription: text("display_description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 42 }).notNull(),
    lastModifiedBy: varchar("last_modified_by", { length: 42 }),
    tags: text("tags").array(),
    isVisible: boolean("is_visible").default(true).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    isInteractable: boolean("is_interactable").default(true).notNull(),
    interactionZone: jsonb("interaction_zone"),
    canSit: boolean("can_sit"),
    canPickup: boolean("can_pickup"),
    canUse: boolean("can_use"),
    isForSale: boolean("is_for_sale"),
    price: doublePrecision("price"),
    currency: varchar("currency", { length: 20 }),
    stock: integer("stock"),
    modelUrl: text("model_url"),
    imageUrl: text("image_url"),
    buildingId: varchar("building_id", { length: 255 }).notNull(),
    roomId: varchar("room_id", { length: 255 }),
  },
  (table) => ({
    buildingIdIdx: index("idx_assets_building_id").on(table.buildingId),
    roomIdIdx: index("idx_assets_room_id").on(table.roomId),
    createdByIdx: index("idx_assets_created_by").on(table.createdBy),
    assetIdIdx: index("idx_assets_asset_id").on(table.assetId),
    createdAtIdx: index("idx_assets_created_at").on(table.createdAt),
    isVisibleIdx: index("idx_assets_is_visible").on(table.isVisible),
    isForSaleIdx: index("idx_assets_is_for_sale").on(table.isForSale),
    buildingRoomIdx: index("idx_assets_building_room").on(table.buildingId, table.roomId),
    fkBuilding: foreignKey({
      columns: [table.buildingId],
      foreignColumns: [buildings.id],
    }).onDelete("cascade"),
  })
);

// ============================================================================
// 3. ROOM COLORS TABLE
// ============================================================================

export const roomColors = pgTable(
  "room_colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: varchar("room_id", { length: 255 }).notNull().unique(),
    buildingId: varchar("building_id", { length: 255 }).notNull(),
    walls: varchar("walls", { length: 7 }).notNull(),
    ceiling: varchar("ceiling", { length: 7 }).notNull(),
    floor: varchar("floor", { length: 7 }).notNull(),
    windows: varchar("windows", { length: 7 }).notNull(),
    windowFrames: varchar("window_frames", { length: 7 }).notNull(),
    doors: varchar("doors", { length: 7 }).notNull(),
    doorFrames: varchar("door_frames", { length: 7 }).notNull(),
    railings: varchar("railings", { length: 7 }).notNull(),
    ambientLightColor: varchar("ambient_light_color", { length: 7 }).notNull(),
    ambientLightIntensity: doublePrecision("ambient_light_intensity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 42 }).notNull(),
    lastModifiedBy: varchar("last_modified_by", { length: 42 }),
    presetName: varchar("preset_name", { length: 255 }),
    isSavedPreset: boolean("is_saved_preset").default(false),
  },
  (table) => ({
    buildingIdIdx: index("idx_room_colors_building_id").on(table.buildingId),
    createdByIdx: index("idx_room_colors_created_by").on(table.createdBy),
    updatedAtIdx: index("idx_room_colors_updated_at").on(table.updatedAt),
    fkBuilding: foreignKey({
      columns: [table.buildingId],
      foreignColumns: [buildings.id],
    }).onDelete("cascade"),
  })
);

// ============================================================================
// 4. EDIT HISTORY TABLE
// ============================================================================

export const editHistory = pgTable(
  "edit_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    buildingId: varchar("building_id", { length: 255 }).notNull(),
    editedBy: varchar("edited_by", { length: 42 }).notNull(),
    editedAt: timestamp("edited_at").defaultNow().notNull(),
    changedFields: text("changed_fields").array().notNull(),
    previousValues: jsonb("previous_values"),
    newValues: jsonb("new_values"),
    signature: text("signature").notNull(),
    signatureValid: boolean("signature_valid").default(true),
    ipfsHash: varchar("ipfs_hash", { length: 255 }),
    transactionHash: varchar("transaction_hash", { length: 255 }),
  },
  (table) => ({
    entityIdIdx: index("idx_edit_history_entity_id").on(table.entityId),
    editedByIdx: index("idx_edit_history_edited_by").on(table.editedBy),
    buildingIdIdx: index("idx_edit_history_building_id").on(table.buildingId),
    editedAtIdx: index("idx_edit_history_edited_at").on(table.editedAt),
    entityTypeIdx: index("idx_edit_history_entity_type").on(table.entityType),
    fkBuilding: foreignKey({
      columns: [table.buildingId],
      foreignColumns: [buildings.id],
    }).onDelete("cascade"),
  })
);

// ============================================================================
// 5. WALLET STATS TABLE
// ============================================================================

export const walletStats = pgTable(
  "wallet_stats",
  {
    walletAddress: varchar("wallet_address", { length: 42 }).primaryKey(),
    assetsCreated: integer("assets_created").default(0).notNull(),
    assetsEdited: integer("assets_edited").default(0).notNull(),
    totalEdits: integer("total_edits").default(0).notNull(),
    firstSeen: timestamp("first_seen"),
    lastSeen: timestamp("last_seen"),
    reputation: integer("reputation").default(0).notNull(),
    verifiedEdits: integer("verified_edits").default(0).notNull(),
    transactionCount: integer("transaction_count").default(0).notNull(),
    totalSpent: doublePrecision("total_spent").default(0).notNull(),
  },
  (table) => ({
    reputationIdx: index("idx_wallet_stats_reputation").on(table.reputation),
    lastSeenIdx: index("idx_wallet_stats_last_seen").on(table.lastSeen),
  })
);

// =============================================================================
// QUERY HELPERS
// =============================================================================

// Mongoose Query Helpers

export const assetQueries = {
  async getByBuilding(buildingId: string) {
    return Asset.find({ buildingId }).sort({ createdAt: -1 });
  },
  async getForSale(buildingId: string) {
    return Asset.find({ buildingId, isForSale: true, stock: { $gt: 0 } });
  },
  async getByCreator(walletAddress: string) {
    return Asset.find({ createdBy: walletAddress }).sort({ createdAt: -1 });
  },
  async getEditHistory(assetId: string) {
    return EditHistory.find({ entityId: assetId }).sort({ editedAt: -1 });
  },
};

export const roomColorQueries = {
  async getByRoomId(roomId: string) {
    return RoomColors.findOne({ roomId });
  },
  async getByBuilding(buildingId: string) {
    return RoomColors.find({ buildingId });
  },
};

export const walletQueries = {
  async getStats(walletAddress: string) {
    return WalletStats.findOne({ walletAddress });
  },
  async getTopContributors(limit = 10) {
    return WalletStats.find().sort({ reputation: -1 }).limit(limit);
  },
};
```










