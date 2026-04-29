import { boolean, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const campaigns = mysqlTable("campaigns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  name: varchar("name", { length: 200 }).notNull(),
  objective: varchar("objective", { length: 200 }),
  status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  publishApprovalChainJson: json("publish_approval_chain_json").$type<Record<string, unknown> | null>(),
  publishApprovalReportScheduleJson: json("publish_approval_report_schedule_json").$type<Record<string, unknown> | null>(),
  bentleyRunId: varchar("bentley_run_id", { length: 128 }),
  bentleyGenerationJson: json("bentley_generation_json").$type<Record<string, unknown> | null>(),
  derivedFromCampaignId: varchar("derived_from_campaign_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const campaignAssets = mysqlTable("campaign_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  creativeType: varchar("creative_type", { length: 24 }).notNull(),
  storageUrl: varchar("storage_url", { length: 512 }),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignPosts = mysqlTable("campaign_posts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  assetId: varchar("asset_id", { length: 36 }),
  socialAccountId: varchar("social_account_id", { length: 36 }),
  platform: varchar("platform", { length: 24 }).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
  caption: text("caption"),
  hashtags: varchar("hashtags", { length: 1000 }),
  linkUrl: varchar("link_url", { length: 512 }),
  utmParams: json("utm_params").$type<Record<string, unknown> | null>(),
  scheduledPublishMeta: json("scheduled_publish_meta").$type<Record<string, unknown> | null>(),
  platformPostId: varchar("platform_post_id", { length: 120 }),
  errorMessage: text("error_message"),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const campaignAuditEvents = mysqlTable("campaign_audit_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  postId: varchar("post_id", { length: 36 }),
  action: varchar("action", { length: 80 }).notNull(),
  platform: varchar("platform", { length: 24 }),
  details: json("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignReviewerAssignments = mysqlTable("campaign_reviewer_assignments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  role: varchar("role", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignReviewerAssignmentAuditEvents = mysqlTable("campaign_reviewer_assignment_audit_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 64 }).notNull(),
  actorUserId: varchar("actor_user_id", { length: 64 }).notNull(),
  previousRole: varchar("previous_role", { length: 24 }),
  nextRole: varchar("next_role", { length: 24 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialAccounts = mysqlTable("social_accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  platform: varchar("platform", { length: 24 }).notNull(),
  authType: varchar("auth_type", { length: 24 }).notNull().default("OAUTH"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: timestamp("expires_at"),
  externalAccountId: varchar("external_account_id", { length: 120 }),
  scopes: varchar("scopes", { length: 500 }),
  displayName: varchar("display_name", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const socialMediaAssets = mysqlTable("social_media_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  generationRunId: varchar("generation_run_id", { length: 36 }),
  assetType: varchar("asset_type", { length: 32 }).notNull().default("image"),
  sourcePrompt: text("source_prompt"),
  platformTargetsJson: json("platform_targets_json").$type<Record<string, unknown> | string[] | null>(),
  generationMetadataJson: json("generation_metadata_json").$type<Record<string, unknown> | null>(),
  width: int("width"),
  height: int("height"),
  aspectRatio: varchar("aspect_ratio", { length: 32 }),
  storageUrl: varchar("storage_url", { length: 1024 }),
  storageKind: varchar("storage_kind", { length: 24 }),
  selected: boolean("selected").notNull().default(false),
  exportStatus: varchar("export_status", { length: 24 }).notNull().default("none"),
  campaignAssetId: varchar("campaign_asset_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignExternalSocialReviewTokens = mysqlTable("campaign_external_social_review_tokens", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  createdByUserId: varchar("created_by_user_id", { length: 64 }).notNull(),
  label: varchar("label", { length: 200 }),
  allowedRolesJson: json("allowed_roles_json").$type<string[] | Record<string, unknown> | null>(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const campaignPostAnalyticsSnapshots = mysqlTable("campaign_post_analytics_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignPostId: varchar("campaign_post_id", { length: 36 }).notNull(),
  provider: varchar("provider", { length: 24 }).notNull(),
  providerPostId: varchar("provider_post_id", { length: 120 }),
  snapshotType: varchar("snapshot_type", { length: 32 }).notNull().default("platform_lifetime"),
  metricsJson: json("metrics_json").$type<Record<string, unknown>>().notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignPaidSocialCampaigns = mysqlTable("campaign_paid_social_campaigns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  internalName: varchar("internal_name", { length: 200 }).notNull(),
  adSetName: varchar("ad_set_name", { length: 200 }),
  adName: varchar("ad_name", { length: 200 }),
  objective: varchar("objective", { length: 32 }).notNull().default(""),
  draftStatus: varchar("draft_status", { length: 24 }).notNull().default("draft"),
  budgetType: varchar("budget_type", { length: 16 }).notNull().default("none"),
  budgetAmountMinor: int("budget_amount_minor"),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  destinationUrl: varchar("destination_url", { length: 1024 }),
  ctaLabel: varchar("cta_label", { length: 120 }),
  leadFormPlaceholder: varchar("lead_form_placeholder", { length: 512 }),
  audienceJson: json("audience_json").$type<Record<string, unknown> | null>(),
  placementsJson: json("placements_json").$type<Record<string, unknown> | string[] | null>(),
  creativeConfigJson: json("creative_config_json").$type<Record<string, unknown> | null>(),
  createdByUserId: varchar("created_by_user_id", { length: 64 }).notNull(),
  updatedByUserId: varchar("updated_by_user_id", { length: 64 }).notNull(),
  metaAdAccountId: varchar("meta_ad_account_id", { length: 64 }),
  metaPageId: varchar("meta_page_id", { length: 64 }),
  metaFacebookSocialAccountId: varchar("meta_facebook_social_account_id", { length: 36 }),
  metaLaunchStatus: varchar("meta_launch_status", { length: 24 }).notNull().default("idle"),
  remoteMetaCampaignId: varchar("remote_meta_campaign_id", { length: 64 }),
  remoteMetaAdsetId: varchar("remote_meta_adset_id", { length: 64 }),
  remoteMetaCreativeId: varchar("remote_meta_creative_id", { length: 64 }),
  remoteMetaAdId: varchar("remote_meta_ad_id", { length: 64 }),
  lastLaunchErrorJson: json("last_launch_error_json").$type<Record<string, unknown> | null>(),
  launchedAt: timestamp("launched_at"),
  lastMetaSyncAt: timestamp("last_meta_sync_at"),
  metaRuntimeStatus: varchar("meta_runtime_status", { length: 24 }),
  lastMetaStatusJson: json("last_meta_status_json").$type<Record<string, unknown> | null>(),
  lastMetaSyncErrorJson: json("last_meta_sync_error_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const campaignPaidSocialAnalyticsSnapshots = mysqlTable("campaign_paid_social_analytics_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  campaignPaidSocialCampaignId: varchar("campaign_paid_social_campaign_id", { length: 36 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  metricsJson: json("metrics_json").$type<Record<string, unknown>>().notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paidSocialSyncBackoffState = mysqlTable("paid_social_sync_backoff_state", {
  id: varchar("id", { length: 36 }).primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  accountKey: varchar("account_key", { length: 128 }).notNull(),
  backoffUntil: timestamp("backoff_until"),
  lastFailureCategory: varchar("last_failure_category", { length: 32 }),
  consecutiveThrottleCount: int("consecutive_throttle_count").notNull().default(0),
  lastFailureAt: timestamp("last_failure_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const socialAccountCapabilities = mysqlTable("social_account_capabilities", {
  socialAccountId: varchar("social_account_id", { length: 36 }).primaryKey(),
  flagsJson: json("flags_json").$type<Record<string, unknown> | null>(),
  defaultDestination: varchar("default_destination", { length: 512 }),
  lastCapabilitySyncAt: timestamp("last_capability_sync_at"),
  settingsJson: json("settings_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const socialPostPlatformVariants = mysqlTable("social_post_platform_variants", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  generationRunId: varchar("generation_run_id", { length: 36 }),
  campaignPostId: varchar("campaign_post_id", { length: 36 }),
  platform: varchar("platform", { length: 24 }).notNull(),
  caption: text("caption"),
  hashtags: varchar("hashtags", { length: 1000 }),
  linkUrl: varchar("link_url", { length: 512 }),
  imagePrompt: text("image_prompt"),
  socialMediaAssetId: varchar("social_media_asset_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementThreads = mysqlTable("social_engagement_threads", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  campaignId: varchar("campaign_id", { length: 36 }),
  socialAccountId: varchar("social_account_id", { length: 36 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  externalThreadId: varchar("external_thread_id", { length: 512 }).notNull(),
  sourceType: varchar("source_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("new"),
  intent: varchar("intent", { length: 64 }),
  sentiment: varchar("sentiment", { length: 32 }),
  urgency: varchar("urgency", { length: 32 }),
  requiresManual: boolean("requires_manual").notNull().default(false),
  lastMessageAt: timestamp("last_message_at"),
  metadataJson: json("metadata_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const socialEngagementMessages = mysqlTable("social_engagement_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  externalMessageId: varchar("external_message_id", { length: 512 }).notNull(),
  direction: varchar("direction", { length: 32 }).notNull(),
  authorDisplay: varchar("author_display", { length: 512 }),
  messageText: text("message_text"),
  rawPayloadJson: json("raw_payload_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementLabels = mysqlTable("social_engagement_labels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  slug: varchar("slug", { length: 64 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  colorHex: varchar("color_hex", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementThreadLabels = mysqlTable("social_engagement_thread_labels", {
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  labelId: varchar("label_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementAssignments = mysqlTable("social_engagement_assignments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  assignedUserId: varchar("assigned_user_id", { length: 64 }).notNull(),
  assignedRole: varchar("assigned_role", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementAiSuggestions = mysqlTable("social_engagement_ai_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  suggestionType: varchar("suggestion_type", { length: 32 }).notNull(),
  suggestedText: text("suggested_text"),
  rationaleJson: json("rationale_json").$type<Record<string, unknown> | null>(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialEngagementIngestErrors = mysqlTable("social_engagement_ingest_errors", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  socialAccountId: varchar("social_account_id", { length: 36 }),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  errorCode: varchar("error_code", { length: 64 }).notNull(),
  errorMessage: text("error_message").notNull(),
  contextJson: json("context_json").$type<Record<string, unknown> | null>(),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().onUpdateNow().notNull(),
  count: int("count").notNull().default(1),
});

export const socialEngagementRules = mysqlTable("social_engagement_rules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  name: varchar("name", { length: 200 }).notNull(),
  conditionsJson: json("conditions_json").$type<Record<string, unknown>>().notNull(),
  actionsJson: json("actions_json").$type<Record<string, unknown>>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const socialEngagementRuleApplications = mysqlTable("social_engagement_rule_applications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  threadId: varchar("thread_id", { length: 36 }).notNull(),
  ruleId: varchar("rule_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignRow = typeof campaigns.$inferSelect;
export type InsertCampaignRow = typeof campaigns.$inferInsert;
export type CampaignPostRow = typeof campaignPosts.$inferSelect;
export type InsertCampaignPostRow = typeof campaignPosts.$inferInsert;
export type CampaignAssetRow = typeof campaignAssets.$inferSelect;
export type InsertCampaignAssetRow = typeof campaignAssets.$inferInsert;
export type CampaignAuditEventRow = typeof campaignAuditEvents.$inferSelect;
export type InsertCampaignAuditEventRow = typeof campaignAuditEvents.$inferInsert;
export type CampaignReviewerAssignmentRow = typeof campaignReviewerAssignments.$inferSelect;
export type CampaignReviewerAssignmentAuditEventRow = typeof campaignReviewerAssignmentAuditEvents.$inferSelect;
export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type InsertSocialAccountRow = typeof socialAccounts.$inferInsert;
export type SocialMediaAssetRow = typeof socialMediaAssets.$inferSelect;
export type CampaignExternalSocialReviewTokenRow = typeof campaignExternalSocialReviewTokens.$inferSelect;
export type InsertCampaignExternalSocialReviewTokenRow = typeof campaignExternalSocialReviewTokens.$inferInsert;
export type CampaignPostAnalyticsSnapshotRow = typeof campaignPostAnalyticsSnapshots.$inferSelect;
export type InsertCampaignPostAnalyticsSnapshotRow = typeof campaignPostAnalyticsSnapshots.$inferInsert;
export type CampaignPaidSocialCampaignRow = typeof campaignPaidSocialCampaigns.$inferSelect;
export type InsertCampaignPaidSocialCampaignRow = typeof campaignPaidSocialCampaigns.$inferInsert;
export type CampaignPaidSocialAnalyticsSnapshotRow = typeof campaignPaidSocialAnalyticsSnapshots.$inferSelect;
export type InsertCampaignPaidSocialAnalyticsSnapshotRow = typeof campaignPaidSocialAnalyticsSnapshots.$inferInsert;
export type PaidSocialSyncBackoffStateRow = typeof paidSocialSyncBackoffState.$inferSelect;
export type InsertPaidSocialSyncBackoffStateRow = typeof paidSocialSyncBackoffState.$inferInsert;
export type SocialAccountCapabilitiesRow = typeof socialAccountCapabilities.$inferSelect;
export type SocialPostPlatformVariantRow = typeof socialPostPlatformVariants.$inferSelect;
export type SocialEngagementThreadRow = typeof socialEngagementThreads.$inferSelect;
export type SocialEngagementMessageRow = typeof socialEngagementMessages.$inferSelect;
export type SocialEngagementLabelRow = typeof socialEngagementLabels.$inferSelect;
export type SocialEngagementThreadLabelRow = typeof socialEngagementThreadLabels.$inferSelect;
export type SocialEngagementAssignmentRow = typeof socialEngagementAssignments.$inferSelect;
export type SocialEngagementAiSuggestionRow = typeof socialEngagementAiSuggestions.$inferSelect;
export type SocialEngagementIngestErrorRow = typeof socialEngagementIngestErrors.$inferSelect;
export type SocialEngagementRuleRow = typeof socialEngagementRules.$inferSelect;
export type SocialEngagementRuleApplicationRow = typeof socialEngagementRuleApplications.$inferSelect;
