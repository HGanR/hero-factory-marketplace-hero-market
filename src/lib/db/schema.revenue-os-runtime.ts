import { boolean, decimal, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const marketSources = mysqlTable("market_sources", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  url: varchar("url", { length: 512 }),
  industry: varchar("industry", { length: 120 }),
  sourceType: varchar("source_type", { length: 64 }),
  lastMarketScanId: varchar("last_market_scan_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsLaunchCycles = mysqlTable("revenue_os_launch_cycles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  scopeKey: varchar("scope_key", { length: 200 }).notNull(),
  clientCycleRef: varchar("client_cycle_ref", { length: 80 }),
  launchPlanSummary: text("launch_plan_summary").notNull(),
  readinessJson: json("readiness_json").$type<Record<string, unknown> | null>(),
  planJson: json("plan_json").$type<Record<string, unknown> | null>(),
  signalsSnapshotJson: json("signals_snapshot_json").$type<Record<string, unknown> | null>(),
  trackingSnapshotJson: json("tracking_snapshot_json").$type<Record<string, unknown> | null>(),
  currentDay: int("current_day").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const revenueOsLaunchCycleDays = mysqlTable("revenue_os_launch_cycle_days", {
  id: varchar("id", { length: 36 }).primaryKey(),
  launchCycleId: varchar("launch_cycle_id", { length: 36 }).notNull(),
  dayNumber: int("day_number").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("not_started"),
  completedActionsJson: json("completed_actions_json").$type<string[] | null>(),
  notesText: text("notes_text"),
  lastActionAt: timestamp("last_action_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsLaunchCycleEvents = mysqlTable("revenue_os_launch_cycle_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  launchCycleId: varchar("launch_cycle_id", { length: 36 }).notNull(),
  dayNumber: int("day_number"),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  eventPayloadJson: json("event_payload_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bentleyDistributionQueue = mysqlTable("bentley_distribution_queue", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  experimentId: varchar("experiment_id", { length: 36 }),
  experimentVariantId: varchar("experiment_variant_id", { length: 36 }),
  marketSweepSnapshotId: varchar("market_sweep_snapshot_id", { length: 36 }),
  contentDeploymentId: varchar("content_deployment_id", { length: 36 }),
  title: varchar("title", { length: 512 }).notNull().default(""),
  platform: varchar("platform", { length: 64 }).notNull().default(""),
  contentType: varchar("content_type", { length: 64 }).notNull().default(""),
  queueStatus: varchar("queue_status", { length: 24 }).notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  publishPriority: int("publish_priority"),
  winningSignalSource: varchar("winning_signal_source", { length: 128 }),
  approvalStatus: varchar("approval_status", { length: 32 }).notNull().default("pending"),
  publishAttemptCount: int("publish_attempt_count").notNull().default(0),
  lastPublishError: text("last_publish_error"),
  externalPostRef: varchar("external_post_ref", { length: 512 }),
  lastSyncedAt: timestamp("last_synced_at"),
  performanceSyncStatus: varchar("performance_sync_status", { length: 64 }),
  leadHandoffStatus: varchar("lead_handoff_status", { length: 64 }),
  workflowNote: text("workflow_note"),
  cadencePriority: int("cadence_priority"),
  staleAfterAt: timestamp("stale_after_at"),
  lastOptimizationAction: varchar("last_optimization_action", { length: 64 }),
  suppressionReason: varchar("suppression_reason", { length: 512 }),
  promotionReason: varchar("promotion_reason", { length: 512 }),
  retestEligibleAt: timestamp("retest_eligible_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyDistributionQueueTargets = mysqlTable("bentley_distribution_queue_targets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  queueId: varchar("queue_id", { length: 36 }).notNull(),
  targetPlatform: varchar("target_platform", { length: 64 }).notNull().default(""),
  targetProfileId: varchar("target_profile_id", { length: 64 }),
  targetFormat: varchar("target_format", { length: 64 }).notNull().default(""),
  payloadJson: json("payload_json").$type<Record<string, unknown> | null>(),
  targetStatus: varchar("target_status", { length: 24 }).notNull().default("draft"),
  routingStatus: varchar("routing_status", { length: 48 }),
  routingWarningsJson: json("routing_warnings_json").$type<Record<string, unknown> | string[] | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyLeadSignals = mysqlTable("bentley_lead_signals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  sourcePlatform: varchar("source_platform", { length: 64 }).notNull().default(""),
  sourceType: varchar("source_type", { length: 48 }).notNull().default("comment"),
  sourceRef: varchar("source_ref", { length: 512 }),
  topic: varchar("topic", { length: 256 }),
  hookType: varchar("hook_type", { length: 64 }),
  angle: varchar("angle", { length: 512 }),
  sentimentScore: decimal("sentiment_score", { precision: 8, scale: 4 }),
  commercialIntentScore: decimal("commercial_intent_score", { precision: 8, scale: 4 }),
  urgencyScore: decimal("urgency_score", { precision: 8, scale: 4 }),
  handoffReadiness: decimal("handoff_readiness", { precision: 8, scale: 4 }),
  extractedText: text("extracted_text").notNull(),
  extractedEntitiesJson: json("extracted_entities_json").$type<Record<string, unknown> | null>(),
  recommendedFollowup: varchar("recommended_followup", { length: 512 }).notNull().default(""),
  experimentId: varchar("experiment_id", { length: 36 }),
  experimentVariantId: varchar("experiment_variant_id", { length: 36 }),
  signalClass: varchar("signal_class", { length: 48 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyLeadHandoffs = mysqlTable("bentley_lead_handoffs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  leadSignalId: varchar("lead_signal_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  handoffStatus: varchar("handoff_status", { length: 32 }).notNull().default("new"),
  ownerUserId: varchar("owner_user_id", { length: 64 }),
  handoffNote: text("handoff_note"),
  recommendedFollowup: varchar("recommended_followup", { length: 512 }).notNull().default(""),
  bentleyNextResponseMode: varchar("bentley_next_response_mode", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyNotificationChannels = mysqlTable("bentley_notification_channels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  channelType: varchar("channel_type", { length: 48 }).notNull().default("in_app"),
  channelLabel: varchar("channel_label", { length: 256 }).notNull().default(""),
  channelConfigJson: json("channel_config_json").$type<Record<string, unknown> | null>(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyNotificationPolicies = mysqlTable("bentley_notification_policies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  eventType: varchar("event_type", { length: 96 }).notNull().default(""),
  minimumSeverity: varchar("minimum_severity", { length: 24 }).notNull().default("info"),
  channelId: varchar("channel_id", { length: 36 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  policyConfigJson: json("policy_config_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyNotificationEvents = mysqlTable("bentley_notification_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  sourceType: varchar("source_type", { length: 48 }).notNull().default("bentley_engine"),
  eventType: varchar("event_type", { length: 96 }).notNull().default(""),
  severity: varchar("severity", { length: 24 }).notNull().default("info"),
  title: varchar("title", { length: 512 }).notNull().default(""),
  body: text("body"),
  eventPayloadJson: json("event_payload_json").$type<Record<string, unknown> | null>(),
  dedupeKey: varchar("dedupe_key", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const bentleyNotificationDeliveries = mysqlTable("bentley_notification_deliveries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  channelId: varchar("channel_id", { length: 36 }).notNull(),
  deliveryStatus: varchar("delivery_status", { length: 24 }).notNull().default("pending"),
  deliveryAttemptCount: int("delivery_attempt_count").notNull().default(0),
  lastDeliveryError: varchar("last_delivery_error", { length: 1024 }),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  deliveryPayloadJson: json("delivery_payload_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyCadenceRuns = mysqlTable("bentley_cadence_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  runType: varchar("run_type", { length: 48 }).notNull().default("daily_refresh"),
  runStatus: varchar("run_status", { length: 24 }).notNull().default("started"),
  runSummaryJson: json("run_summary_json").$type<Record<string, unknown> | null>(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsWorkspaceApis = mysqlTable("revenue_os_workspace_apis", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  provider: varchar("provider", { length: 64 }).notNull(),
  label: varchar("label", { length: 120 }),
  apiKeyEnc: text("api_key_enc"),
  endpointUrl: varchar("endpoint_url", { length: 512 }),
  costAcknowledgmentAt: timestamp("cost_acknowledgment_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const contentFeedbackLog = mysqlTable("content_feedback_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  source: varchar("source", { length: 32 }).notNull().default("manual"),
  campaignId: varchar("campaign_id", { length: 36 }),
  platform: varchar("platform", { length: 64 }),
  sentiment: varchar("sentiment", { length: 24 }),
  scoreDelta: decimal("score_delta", { precision: 8, scale: 4 }),
  rawPayload: json("raw_payload").$type<Record<string, unknown> | null>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketIntelligenceSnapshots = mysqlTable("market_intelligence_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  industry: varchar("industry", { length: 200 }).notNull(),
  targetAudience: varchar("target_audience", { length: 300 }).notNull().default(""),
  queryFingerprint: varchar("query_fingerprint", { length: 64 }).notNull().default(""),
  realSignals: json("real_signals").$type<Record<string, unknown> | null>(),
  mergedResult: json("merged_result").$type<Record<string, unknown> | null>(),
  scoredSignals: json("scored_signals").$type<Record<string, unknown> | null>(),
  decisionHint: varchar("decision_hint", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bentleyContentExperiments = mysqlTable("bentley_content_experiments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  marketSweepSnapshotId: varchar("market_sweep_snapshot_id", { length: 36 }),
  nextActionType: varchar("next_action_type", { length: 64 }).notNull().default(""),
  contentGenerationMode: varchar("content_generation_mode", { length: 64 }).notNull().default(""),
  experimentTheme: varchar("experiment_theme", { length: 300 }).notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  hypothesis: text("hypothesis"),
  primaryMetric: varchar("primary_metric", { length: 120 }).notNull().default("engagement_rate"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyContentExperimentVariants = mysqlTable("bentley_content_experiment_variants", {
  id: varchar("id", { length: 36 }).primaryKey(),
  experimentId: varchar("experiment_id", { length: 36 }).notNull(),
  variantKey: varchar("variant_key", { length: 8 }).notNull(),
  hookType: varchar("hook_type", { length: 64 }).notNull().default(""),
  angle: varchar("angle", { length: 500 }).notNull().default(""),
  ctaType: varchar("cta_type", { length: 64 }).notNull().default(""),
  platform: varchar("platform", { length: 64 }).notNull().default(""),
  contentType: varchar("content_type", { length: 64 }).notNull().default(""),
  generationPayloadJson: json("generation_payload_json").$type<Record<string, unknown> | null>(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyContentExperimentResults = mysqlTable("bentley_content_experiment_results", {
  id: varchar("id", { length: 36 }).primaryKey(),
  experimentVariantId: varchar("experiment_variant_id", { length: 36 }).notNull(),
  impressions: int("impressions"),
  views: int("views"),
  clicks: int("clicks"),
  comments: int("comments"),
  saves: int("saves"),
  shares: int("shares"),
  leads: int("leads"),
  conversions: int("conversions"),
  negativeSentimentRatio: decimal("negative_sentiment_ratio", { precision: 8, scale: 4 }),
  qualitativeNotes: text("qualitative_notes"),
  measuredAt: timestamp("measured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const internalJobRuns = mysqlTable("internal_job_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobType: varchar("job_type", { length: 120 }).notNull(),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at").notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  summaryJson: json("summary_json").$type<Record<string, unknown> | null>(),
  errorCount: int("error_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bentleyOperatorSnapshots = mysqlTable("bentley_operator_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  snapshotType: varchar("snapshot_type", { length: 48 }).notNull().default("workspace_summary"),
  scopeJson: json("scope_json").$type<Record<string, unknown> | null>(),
  summaryJson: json("summary_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueOsDeploymentFeedback = mysqlTable("revenue_os_deployment_feedback", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  campaignPostId: varchar("campaign_post_id", { length: 36 }).notNull(),
  platform: varchar("platform", { length: 24 }).notNull(),
  publishStatus: varchar("publish_status", { length: 32 }).notNull(),
  feedbackRowKind: varchar("feedback_row_kind", { length: 32 }).notNull().default("publish_outcome"),
  feedbackJson: json("feedback_json").$type<Record<string, unknown>>().notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const revenueOsPostOptimizationMemory = mysqlTable("revenue_os_post_optimization_memory", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 64 }),
  patternKey: varchar("pattern_key", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 24 }).notNull(),
  contentType: varchar("content_type", { length: 80 }),
  hookText: text("hook_text"),
  angleText: text("angle_text"),
  ctaText: text("cta_text"),
  source: varchar("source", { length: 32 }).notNull(),
  outcomeKind: varchar("outcome_kind", { length: 24 }).notNull(),
  summaryText: text("summary_text").notNull(),
  evidenceJson: json("evidence_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyPolicyScenarios = mysqlTable("bentley_policy_scenarios", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }),
  trustId: varchar("trust_id", { length: 36 }),
  scenarioType: varchar("scenario_type", { length: 32 }).notNull().default("blended"),
  name: varchar("name", { length: 255 }).notNull().default(""),
  description: text("description"),
  basePolicySnapshotJson: json("base_policy_snapshot_json").$type<Record<string, unknown> | null>(),
  proposedPolicySnapshotJson: json("proposed_policy_snapshot_json").$type<Record<string, unknown> | null>(),
  isSaved: boolean("is_saved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyPolicyScenarioRuns = mysqlTable("bentley_policy_scenario_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  scenarioId: varchar("scenario_id", { length: 36 }).notNull(),
  runStatus: varchar("run_status", { length: 24 }).notNull().default("completed"),
  comparisonJson: json("comparison_json").$type<Record<string, unknown> | null>(),
  riskSummaryJson: json("risk_summary_json").$type<Record<string, unknown> | null>(),
  recommendationJson: json("recommendation_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bentleyPolicyChangeSets = mysqlTable("bentley_policy_change_sets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  sourceScenarioId: varchar("source_scenario_id", { length: 36 }),
  sourceRolloutPlanId: varchar("source_rollout_plan_id", { length: 36 }),
  sourceRollbackPackageId: varchar("source_rollback_package_id", { length: 36 }),
  name: varchar("name", { length: 255 }).notNull().default(""),
  description: text("description"),
  changeSetType: varchar("change_set_type", { length: 32 }).notNull().default("blended_update"),
  scopeJson: json("scope_json").$type<Record<string, unknown> | null>(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyPolicyChangeSetItems = mysqlTable("bentley_policy_change_set_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  changeSetId: varchar("change_set_id", { length: 36 }).notNull(),
  policyFamily: varchar("policy_family", { length: 24 }).notNull(),
  itemOrder: int("item_order").notNull().default(0),
  itemStatus: varchar("item_status", { length: 24 }).notNull().default("pending"),
  targetScopeJson: json("target_scope_json").$type<Record<string, unknown> | null>(),
  payloadJson: json("payload_json").$type<Record<string, unknown> | null>(),
  resultJson: json("result_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const bentleyPolicyChangeSetRuns = mysqlTable("bentley_policy_change_set_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  changeSetId: varchar("change_set_id", { length: 36 }).notNull(),
  runStatus: varchar("run_status", { length: 24 }).notNull().default("started"),
  runSummaryJson: json("run_summary_json").$type<Record<string, unknown> | null>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RevenueOsPostOptimizationMemoryRow = typeof revenueOsPostOptimizationMemory.$inferSelect;
export type RevenueOsDeploymentFeedbackRow = typeof revenueOsDeploymentFeedback.$inferSelect;

/** See `migrations/add_bentley_optimization_runs.sql` + `add_bentley_optimization_compare_and_execution.sql`. */
export const bentleyOptimizationRuns = mysqlTable("bentley_optimization_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  campaignId: varchar("campaign_id", { length: 36 }).notNull(),
  parentCampaignId: varchar("parent_campaign_id", { length: 36 }),
  bentleyRunId: varchar("bentley_run_id", { length: 128 }),
  optimizationKey: varchar("optimization_key", { length: 128 }).notNull(),
  postIdsJson: json("post_ids_json").$type<string[] | null>(),
  sourceMetricsSummaryJson: json("source_metrics_summary_json").$type<Record<string, unknown>>().notNull(),
  resultJson: json("result_json").$type<Record<string, unknown>>().notNull(),
  executionMode: varchar("execution_mode", { length: 24 }).notNull(),
  childCampaignId: varchar("child_campaign_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executionTraceJson: json("execution_trace_json").$type<Record<string, unknown> | null>(),
  comparisonJson: json("comparison_json").$type<Record<string, unknown> | null>(),
  improvementScore: decimal("improvement_score", { precision: 12, scale: 6 }),
  winningVariant: boolean("winning_variant"),
});

/** See `drizzle/0067_bentley_autonomous_approval_audit.sql`. */
export const bentleyAutonomousActionAudit = mysqlTable("bentley_autonomous_action_audit", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().default(""),
  clientId: varchar("client_id", { length: 36 }).notNull().default(""),
  trustId: varchar("trust_id", { length: 36 }).notNull().default(""),
  sourceType: varchar("source_type", { length: 48 }).notNull().default("autonomous_engine"),
  actionType: varchar("action_type", { length: 64 }).notNull().default(""),
  actionStatus: varchar("action_status", { length: 32 }).notNull().default("planned"),
  relatedRunId: varchar("related_run_id", { length: 36 }),
  relatedApprovalRequestId: varchar("related_approval_request_id", { length: 36 }),
  targetIdsJson: json("target_ids_json").$type<unknown[] | Record<string, unknown> | null>(),
  actionPayloadJson: json("action_payload_json").$type<Record<string, unknown> | null>(),
  resultPayloadJson: json("result_payload_json").$type<Record<string, unknown> | null>(),
  rationaleJson: json("rationale_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** See `client-hub-ensure.ts` — physical column names are camelCase in TiDB/MySQL. */
export const clientAccounts = mysqlTable("client_accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  workspaceId: varchar("workspaceId", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  notes: text("notes"),
  logoUrl: text("logoUrl"),
  servicesJson: text("servicesJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

