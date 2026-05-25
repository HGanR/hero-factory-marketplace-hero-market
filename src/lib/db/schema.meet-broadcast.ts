/**
 * Drizzle tables for Meet broadcast + stream destinations + avatar NFT cache.
 * Column names match MySQL migrations under drizzle/0091–0103.
 */
import { mysqlTable, int, varchar, boolean, timestamp, text, json } from "drizzle-orm/mysql-core";

export const streamDestinations = mysqlTable("stream_destinations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  label: varchar("label", { length: 120 }).notNull().default(""),
  serverUrl: varchar("server_url", { length: 1024 }).notNull().default(""),
  streamKeyEncrypted: text("stream_key_encrypted").notNull(),
  streamKeyLast4: varchar("stream_key_last4", { length: 8 }).notNull().default(""),
  orientationPreference: varchar("orientation_preference", { length: 16 }).notNull().default("auto"),
  isActive: boolean("is_active").notNull().default(true),
  requiresManualGoLive: boolean("requires_manual_go_live").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastTestedAt: timestamp("last_tested_at"),
});

export type StreamDestinationRow = typeof streamDestinations.$inferSelect;

export const meetBroadcastSessions = mysqlTable("meet_broadcast_sessions", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("room_id", { length: 256 }).notNull(),
  userId: int("user_id").notNull(),
  livekitEgressId: varchar("livekit_egress_id", { length: 128 }).notNull().default(""),
  status: varchar("status", { length: 32 }).notNull().default("starting"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  layoutMode: varchar("layout_mode", { length: 64 }).notNull().default("grid"),
  recordingEnabled: boolean("recording_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  sceneConfigJson: json("scene_config_json").$type<Record<string, unknown> | null>(),
  compositorMode: varchar("compositor_mode", { length: 32 }).notNull().default("v1_livekit_default"),
  renderSessionId: int("render_session_id"),
  compositorFallbackFromV2: boolean("compositor_fallback_from_v2").notNull().default(false),
  broadcastEventId: int("broadcast_event_id"),
});

export const meetBroadcastSessionDestinations = mysqlTable("meet_broadcast_session_destinations", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  streamDestinationId: int("stream_destination_id"),
  platform: varchar("platform", { length: 32 }).notNull(),
  label: varchar("label", { length: 120 }).notNull().default(""),
  resolvedOutputUrlMasked: varchar("resolved_output_url_masked", { length: 2048 }).notNull().default(""),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  lastError: text("last_error"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
});

export const meetBroadcastRenderSessions = mysqlTable("meet_broadcast_render_sessions", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  accessToken: varchar("access_token", { length: 64 }).notNull(),
  renderModelJson: json("render_model_json").$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetBroadcastScenePresets = mysqlTable("meet_broadcast_scene_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  configJson: json("config_json").$type<Record<string, unknown>>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastLiveSceneStates = mysqlTable("meet_broadcast_live_scene_states", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  sceneStateJson: json("scene_state_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastOverlayStates = mysqlTable("meet_broadcast_overlay_states", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  overlayStateJson: json("overlay_state_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastScheduleStates = mysqlTable("meet_broadcast_schedule_states", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  scheduleStateJson: json("schedule_state_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastAutoDirectingStates = mysqlTable("meet_broadcast_auto_directing_states", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  directingStateJson: json("directing_state_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastTimelineTemplates = mysqlTable("meet_broadcast_timeline_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  templateJson: json("template_json").$type<Record<string, unknown>>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** Durable per-session operator timeline (`drizzle/0099_meet_broadcast_timeline_events.sql`). */
export const meetBroadcastTimelineEvents = mysqlTable("meet_broadcast_timeline_events", {
  id: int("id").autoincrement().primaryKey(),
  broadcastSessionId: int("broadcast_session_id").notNull(),
  userId: int("user_id").notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  summary: varchar("summary", { length: 512 }).notNull(),
  detailsJson: json("details_json").$type<Record<string, unknown> | null>(),
  eventAt: timestamp("event_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetBroadcastEvents = mysqlTable("meet_broadcast_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  scheduledStartAt: timestamp("scheduled_start_at").notNull(),
  scheduledEndAt: timestamp("scheduled_end_at"),
  timezone: varchar("timezone", { length: 64 }),
  roomId: varchar("room_id", { length: 256 }),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  scenePresetId: int("scene_preset_id"),
  defaultTimelineTemplateId: int("default_timeline_template_id"),
  showPackageId: int("show_package_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastCalendarLinks = mysqlTable("meet_broadcast_calendar_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  broadcastEventId: int("broadcast_event_id").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  externalCalendarId: varchar("external_calendar_id", { length: 256 }),
  externalEventId: varchar("external_event_id", { length: 256 }),
  externalEventUrl: varchar("external_event_url", { length: 512 }),
  syncMode: varchar("sync_mode", { length: 40 }).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastOverlayPacks = mysqlTable("meet_broadcast_overlay_packs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 2000 }),
  lowerThirdPresetJson: json("lower_third_preset_json").$type<Record<string, unknown> | null>(),
  tickerPresetJson: json("ticker_preset_json").$type<Record<string, unknown> | null>(),
  ctaPresetJson: json("cta_preset_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastGuestCardPacks = mysqlTable("meet_broadcast_guest_card_packs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 2000 }),
  guestCardsJson: json("guest_cards_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetBroadcastShowPackages = mysqlTable("meet_broadcast_show_packages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 2000 }),
  scenePresetId: int("scene_preset_id"),
  timelineTemplateId: int("timeline_template_id"),
  defaultBrandingJson: json("default_branding_json").$type<Record<string, unknown> | null>(),
  defaultOverlayPackId: int("default_overlay_pack_id"),
  defaultGuestCardPackId: int("default_guest_card_pack_id"),
  defaultRoomId: varchar("default_room_id", { length: 256 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const meetAvatarNftMetadataCache = mysqlTable("meet_avatar_nft_metadata_cache", {
  id: varchar("id", { length: 36 }).primaryKey(),
  chainId: int("chain_id").notNull(),
  contractAddress: varchar("contract_address", { length: 66 }).notNull(),
  tokenId: varchar("token_id", { length: 255 }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  metadataUrl: text("metadata_url"),
  name: text("name"),
  image: text("image"),
  animationUrl: text("animation_url"),
  externalUrl: text("external_url"),
  description: text("description"),
  rawMetadataJson: json("raw_metadata_json").$type<Record<string, unknown> | null>(),
  fetchStatus: varchar("fetch_status", { length: 24 }).notNull(),
  fetchError: text("fetch_error"),
  fetchedAt: timestamp("fetched_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type MeetBroadcastSessionRow = typeof meetBroadcastSessions.$inferSelect;
export type MeetBroadcastSessionDestinationRow = typeof meetBroadcastSessionDestinations.$inferSelect;
