/**
 * Bentley Social Lead Intelligence — analysis-only lead batches (public surface + heuristics).
 * No outreach execution; stored intelligence for operator review.
 */

import { index, int, json, mysqlTable, text, timestamp, uniqueIndex, varchar, decimal } from "drizzle-orm/mysql-core";
import { marketplaceUsers } from "./schema";

export const leadUploadStatus = ["pending", "parsed", "failed"] as const;
export type LeadUploadStatus = (typeof leadUploadStatus)[number];

export const leadUploadSourceType = ["csv", "pdf", "txt", "paste", "csv_sli"] as const;

export const leadAnalysisRunStatus = ["queued", "running", "completed", "failed", "partial"] as const;

export const leadAccessStatus = [
  "public",
  "access_limited",
  "private",
  "broken_link",
  "not_found",
] as const;

/** Batch upload metadata + parse status. */
export const leadUploads = mysqlTable(
  "lead_uploads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    filename: varchar("filename", { length: 512 }).notNull().default(""),
    sourceType: varchar("sourceType", { length: 32 }).notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
    parsedCount: int("parsedCount").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    rawMetaJson: json("rawMetaJson").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("lead_uploads_user_idx").on(t.userId),
    uploadedIdx: index("lead_uploads_uploaded_idx").on(t.uploadedAt),
  })
);

/** One row per parsed lead line. */
export const leadRecords = mysqlTable(
  "lead_records",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uploadId: varchar("uploadId", { length: 36 })
      .notNull()
      .references(() => leadUploads.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    businessName: varchar("businessName", { length: 512 }).notNull().default(""),
    platform: varchar("platform", { length: 64 }).notNull().default(""),
    handle: varchar("handle", { length: 256 }).notNull().default(""),
    profileUrl: text("profileUrl"),
    email: varchar("email", { length: 320 }),
    websiteUrl: text("websiteUrl"),
    notes: text("notes"),
    rawPayloadJson: json("rawPayloadJson").$type<Record<string, unknown>>(),
    normalizedPayloadJson: json("normalizedPayloadJson").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    uploadIdx: index("lead_records_upload_idx").on(t.uploadId),
    userIdx: index("lead_records_user_idx").on(t.userId),
  })
);

export const leadAnalysisRuns = mysqlTable(
  "lead_analysis_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uploadId: varchar("uploadId", { length: 36 })
      .notNull()
      .references(() => leadUploads.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    modelVersion: varchar("modelVersion", { length: 64 }).notNull().default("bentley-sli-v1"),
    pipelineVersion: varchar("pipelineVersion", { length: 64 }).notNull().default("bentley-sli-v2"),
    totalLeads: int("totalLeads").notNull().default(0),
    successCount: int("successCount").notNull().default(0),
    failureCount: int("failureCount").notNull().default(0),
    /** Frozen `computeBatchSummary` output when the run completes. */
    summarySnapshotJson: json("summarySnapshotJson").$type<Record<string, unknown> | null>(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    uploadIdx: index("lead_analysis_runs_upload_idx").on(t.uploadId),
    userIdx: index("lead_analysis_runs_user_idx").on(t.userId),
  })
);

/**
 * Operator-initiated structured handoff from Bentley SLI → AI Revenue OS / Content Bundle workflows.
 * Payload JSON is the canonical audit record; upload/run refs are indexed for queries.
 */
export const bentleyContentBundleHandoffs = mysqlTable(
  "bentley_content_bundle_handoffs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    uploadId: varchar("uploadId", { length: 36 }),
    runId: varchar("runId", { length: 36 }),
    payloadJson: json("payloadJson").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("bentley_cb_handoff_user_idx").on(t.userId),
    createdIdx: index("bentley_cb_handoff_created_idx").on(t.createdAt),
  })
);

/** Prepared Content Engine output for manual deploy (Phase 4D); no auto-posting. */
export const bentleyContentDeployments = mysqlTable(
  "bentley_content_deployments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    platform: varchar("platform", { length: 64 }).notNull(),
    title: varchar("title", { length: 512 }).notNull().default(""),
    hook: text("hook"),
    caption: text("caption"),
    cta: text("cta"),
    hashtagsJson: json("hashtagsJson").$type<string[] | null>(),
    fullExportJson: json("fullExportJson").$type<Record<string, unknown>>().notNull(),
    contentEngineHash: varchar("contentEngineHash", { length: 64 }),
    /** Phase 4H — links deploy back to saved generation variant for audit / outcomes. */
    generationVariantId: varchar("generationVariantId", { length: 36 }),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    postedAt: timestamp("postedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("bentley_cd_user_idx").on(t.userId),
    userStatusIdx: index("bentley_cd_status_idx").on(t.userId, t.status),
    userGenVarIdx: index("bentley_cd_genvar").on(t.userId, t.generationVariantId),
  })
);

/** Phase 4H — persisted Content Engine / campaign outputs + unified context snapshot for audit & experiments. */
export const bentleyGenerationVariants = mysqlTable(
  "bentley_generation_variants",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    experimentGroupId: varchar("experimentGroupId", { length: 36 }).notNull(),
    variantTag: varchar("variantTag", { length: 16 }).notNull().default("A"),
    engineKind: varchar("engineKind", { length: 32 }).notNull().default("content_engine"),
    title: varchar("title", { length: 512 }).notNull().default(""),
    unifiedContextSnapshotJson: json("unifiedContextSnapshotJson").$type<Record<string, unknown>>().notNull(),
    generatedOutputJson: json("generatedOutputJson").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("bentley_gen_var_user_created").on(t.userId, t.createdAt),
    userGroupIdx: index("bentley_gen_var_user_group").on(t.userId, t.experimentGroupId),
  })
);

/** Phase 4J — pre-post queue rows (batch variations + platform packs); link to deployment when live. */
export const bentleyContentQueueItems = mysqlTable(
  "bentley_content_queue_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    generationVariantId: varchar("generationVariantId", { length: 36 }),
    batchId: varchar("batchId", { length: 36 }),
    variationIndex: int("variationIndex"),
    queueStatus: varchar("queueStatus", { length: 20 }).notNull().default("draft"),
    platformFormat: varchar("platformFormat", { length: 32 }).notNull().default("multi"),
    title: varchar("title", { length: 512 }).notNull().default(""),
    payloadJson: json("payloadJson").$type<Record<string, unknown>>().notNull(),
    contentDeploymentId: varchar("contentDeploymentId", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userStatusIdx: index("bentley_cq_user_status").on(t.userId, t.queueStatus),
    userBatchIdx: index("bentley_cq_user_batch").on(t.userId, t.batchId),
    userGenVarIdx: index("bentley_cq_user_genvar").on(t.userId, t.generationVariantId),
  })
);

/** Lightweight operator lead list — manual + engagement pipeline + optional Bentley analysis link. */
export const bentleyTrackedLeads = mysqlTable(
  "bentley_tracked_leads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => marketplaceUsers.id),
    platform: varchar("platform", { length: 64 }).notNull(),
    handle: varchar("handle", { length: 256 }).notNull(),
    comment: text("comment").notNull(),
    painType: varchar("painType", { length: 128 }).notNull().default(""),
    intentScore: decimal("intentScore", { precision: 8, scale: 4 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    source: varchar("source", { length: 32 }).notNull(),
    leadRecordId: varchar("leadRecordId", { length: 36 }),
    contentDeploymentId: varchar("contentDeploymentId", { length: 36 }),
    analysisRunId: varchar("analysisRunId", { length: 36 }),
    /** Engagement / SLI batch that produced this lead row (when applicable). */
    uploadId: varchar("uploadId", { length: 36 }),
    contactedAt: timestamp("contactedAt"),
    bookedAt: timestamp("bookedAt"),
    closedAt: timestamp("closedAt"),
    lostAt: timestamp("lostAt"),
    estimatedValue: decimal("estimatedValue", { precision: 14, scale: 2 }),
    closedValue: decimal("closedValue", { precision: 14, scale: 2 }),
    outcomeNotes: text("outcomeNotes"),
    lossReason: varchar("lossReason", { length: 512 }),
    /** Operator 0–1 confidence in attribution links (not model confidence). */
    attributionConfidence: decimal("attributionConfidence", { precision: 4, scale: 3 }),
    /** Frozen provenance at first link / sync — immune to later content edits. */
    attributionSnapshotJson: json("attributionSnapshotJson").$type<Record<string, unknown>>(),
    /** Denormalized from analysis for fast grouping (optional). */
    commercialReadiness: varchar("commercialReadiness", { length: 32 }),
    rawPayloadJson: json("rawPayloadJson").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userLeadRecUq: uniqueIndex("bentley_tl_user_leadrec").on(t.userId, t.leadRecordId),
    userStatusIdx: index("bentley_tl_user_status").on(t.userId, t.status),
    userSourceIdx: index("bentley_tl_source").on(t.userId, t.source),
    userUploadIdx: index("bentley_tl_upload_idx").on(t.userId, t.uploadId),
    userDeployIdx: index("bentley_tl_deploy_idx").on(t.userId, t.contentDeploymentId),
  })
);

export const leadAnalyses = mysqlTable(
  "lead_analyses",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    leadRecordId: varchar("leadRecordId", { length: 36 })
      .notNull()
      .references(() => leadRecords.id, { onDelete: "cascade" }),
    analysisRunId: varchar("analysisRunId", { length: 36 })
      .notNull()
      .references(() => leadAnalysisRuns.id, { onDelete: "cascade" }),
    accessStatus: varchar("accessStatus", { length: 32 }).notNull().default("access_limited"),
    confidenceScore: decimal("confidenceScore", { precision: 6, scale: 4 }).notNull().default("0.5"),
    visibilityScore: decimal("visibilityScore", { precision: 6, scale: 4 }).notNull().default("0"),
    demandScore: decimal("demandScore", { precision: 6, scale: 4 }).notNull().default("0"),
    intentScore: decimal("intentScore", { precision: 6, scale: 4 }).notNull().default("0"),
    frictionScore: decimal("frictionScore", { precision: 6, scale: 4 }).notNull().default("0"),
    fitScore: decimal("fitScore", { precision: 6, scale: 4 }).notNull().default("0"),
    opportunityScore: decimal("opportunityScore", { precision: 6, scale: 4 }).notNull().default("0"),
    businessType: varchar("businessType", { length: 128 }).notNull().default(""),
    maturityStage: varchar("maturityStage", { length: 64 }).notNull().default(""),
    inferredVertical: varchar("inferredVertical", { length: 64 }).notNull().default("general_service_business"),
    leadType: varchar("leadType", { length: 64 }).notNull().default("local_service_business"),
    commercialReadiness: varchar("commercialReadiness", { length: 16 }).notNull().default("moderate"),
    summary: text("summary"),
    accountSummaryJson: json("accountSummaryJson").$type<Record<string, unknown>>(),
    contentSummaryJson: json("contentSummaryJson").$type<Record<string, unknown>>(),
    commentSummaryJson: json("commentSummaryJson").$type<Record<string, unknown>>(),
    strengthsJson: json("strengthsJson").$type<string[]>(),
    weakSpotsJson: json("weakSpotsJson").$type<string[]>(),
    painPointsJson: json("painPointsJson").$type<string[]>(),
    repeatedBuyerQuestionsJson: json("repeatedBuyerQuestionsJson").$type<string[]>(),
    objectionThemesJson: json("objectionThemesJson").$type<string[]>(),
    demandSignalsJson: json("demandSignalsJson").$type<string[]>(),
    bestOfferAngle: text("bestOfferAngle"),
    suggestedCommentAngle: text("suggestedCommentAngle"),
    suggestedFollowMessageAngle: text("suggestedFollowMessageAngle"),
    suggestedEmailAngle: text("suggestedEmailAngle"),
    suggestedNextMove: text("suggestedNextMove"),
    riskNotesJson: json("riskNotesJson").$type<string[]>(),
    rawAnalysisJson: json("rawAnalysisJson").$type<Record<string, unknown>>(),
    scoreExplanationJson: json("scoreExplanationJson").$type<Record<string, unknown>>(),
    websiteGradeJson: json("websiteGradeJson").$type<Record<string, unknown>>(),
    coverageJson: json("coverageJson").$type<Record<string, unknown>>(),
    evidenceJson: json("evidenceJson").$type<Record<string, unknown>>(),
    findingConfidenceJson: json("findingConfidenceJson").$type<Record<string, unknown>>(),
    topLeadDriversJson: json("topLeadDriversJson").$type<Record<string, unknown>>(),
    rankingDiagnosticsJson: json("rankingDiagnosticsJson").$type<Record<string, unknown>>(),
    actionRationale: text("actionRationale"),
    operatorStatus: varchar("operatorStatus", { length: 32 }).notNull().default("new"),
    operatorPriority: varchar("operatorPriority", { length: 16 }).notNull().default("normal"),
    operatorNotes: text("operatorNotes"),
    operatorOverrideLeadType: varchar("operatorOverrideLeadType", { length: 64 }),
    operatorOverrideCommercialReadiness: varchar("operatorOverrideCommercialReadiness", { length: 16 }),
    operatorOverrideBestOfferAngle: text("operatorOverrideBestOfferAngle"),
    operatorOverrideWeakSpotsJson: json("operatorOverrideWeakSpotsJson").$type<string[]>(),
    operatorOverrideLeadTypeReason: text("operatorOverrideLeadTypeReason"),
    operatorOverrideCommercialReadinessReason: text("operatorOverrideCommercialReadinessReason"),
    operatorOverrideBestOfferAngleReason: text("operatorOverrideBestOfferAngleReason"),
    operatorOverrideWeakSpotsReason: text("operatorOverrideWeakSpotsReason"),
    operatorFeedbackLeadType: varchar("operatorFeedbackLeadType", { length: 32 }),
    operatorFeedbackCommercialReadiness: varchar("operatorFeedbackCommercialReadiness", { length: 32 }),
    operatorFeedbackWeakSpots: varchar("operatorFeedbackWeakSpots", { length: 32 }),
    operatorFeedbackBestOfferAngle: varchar("operatorFeedbackBestOfferAngle", { length: 32 }),
    manuallyReviewedAt: timestamp("manuallyReviewedAt"),
    analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    leadIdx: index("lead_analyses_lead_idx").on(t.leadRecordId),
    runIdx: index("lead_analyses_run_idx").on(t.analysisRunId),
  })
);

export type LeadUploadRow = typeof leadUploads.$inferSelect;
export type LeadRecordRow = typeof leadRecords.$inferSelect;
export type LeadAnalysisRunRow = typeof leadAnalysisRuns.$inferSelect;
export type LeadAnalysisRow = typeof leadAnalyses.$inferSelect;
export type BentleyContentBundleHandoffRow = typeof bentleyContentBundleHandoffs.$inferSelect;
export type BentleyContentDeploymentRow = typeof bentleyContentDeployments.$inferSelect;
export type BentleyContentQueueItemRow = typeof bentleyContentQueueItems.$inferSelect;
export type BentleyTrackedLeadRow = typeof bentleyTrackedLeads.$inferSelect;
