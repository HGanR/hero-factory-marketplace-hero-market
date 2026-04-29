/**
 * Pre-accounting / tax prep workspace — server persistence (MySQL via Drizzle).
 */
import {
  mysqlTable,
  int,
  varchar,
  boolean,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const accountingProfiles = mysqlTable(
  "accounting_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    workspaceId: varchar("workspaceId", { length: 64 }),
    taxYear: int("taxYear").notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    accountingBasis: varchar("accountingBasis", { length: 16 }).notNull().default("unknown"),
    hasPayroll: boolean("hasPayroll").default(false).notNull(),
    hasContractors: boolean("hasContractors").default(false).notNull(),
    hasInventory: boolean("hasInventory").default(false).notNull(),
    hasFixedAssets: boolean("hasFixedAssets").default(false).notNull(),
    priorYearReturnAvailable: boolean("priorYearReturnAvailable").default(false).notNull(),
    /** draft | in_review | ready_for_preparer | needs_followup | finalized_for_handoff */
    reviewStatus: varchar("reviewStatus", { length: 40 }).notNull().default("draft"),
    /** Client-facing notes for preparer (may appear in handoff when enabled). */
    preparerNotes: text("preparerNotes"),
    /** Internal reviewer-only notes — never shown to client-facing exports by default. */
    internalReviewNotes: text("internalReviewNotes"),
    /** Default JSON for handoff packet section toggles and document selection. */
    defaultHandoffCompositionJson: text("defaultHandoffCompositionJson"),
    /** Reviewer acknowledgement when elevating review status despite readiness gate warnings. */
    handoffReadinessOverrideNote: text("handoffReadinessOverrideNote"),
    handoffReadinessOverrideAt: timestamp("handoffReadinessOverrideAt"),
    /** JSON: quarterly Q1–Q4 state */
    quarterStatesJson: text("quarterStatesJson"),
    /** JSON: string[] document tag checklist */
    documentsTagsJson: text("documentsTagsJson"),
    /** JSON: extended PreAccountingProfile facts (banks, processors, mileage, etc.) */
    extendedFactsJson: text("extendedFactsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userYearUidx: uniqueIndex("accounting_profiles_user_year_uidx").on(t.userId, t.taxYear),
    userIdx: index("accounting_profiles_user_idx").on(t.userId),
  })
);

export const accountingDocumentRecords = mysqlTable(
  "accounting_document_records",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    documentName: varchar("documentName", { length: 512 }).notNull(),
    documentTag: varchar("documentTag", { length: 64 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 1024 }),
    storageKey: varchar("storageKey", { length: 512 }),
    mimeType: varchar("mimeType", { length: 128 }),
    reportingPeriodLabel: varchar("reportingPeriodLabel", { length: 64 }),
    quarterLabel: varchar("quarterLabel", { length: 8 }),
    taxYear: int("taxYear").notNull(),
    /** uploaded | missing | needs_review | accepted | rejected | superseded */
    status: varchar("status", { length: 32 }).notNull().default("uploaded"),
    rejectionReason: text("rejectionReason"),
    supersedesDocumentId: int("supersedesDocumentId"),
    /** bank_statement | p_l | balance_sheet | payroll_summary | tax_form | receipt | other | null */
    reportType: varchar("reportType", { length: 64 }),
    /** JSON: { accountLabel?, categoryPattern?, transactionRef? } */
    ledgerContextJson: text("ledgerContextJson"),
    includeInHandoff: boolean("includeInHandoff").notNull().default(true),
    /** JSON string[] — tax form candidate formCode values this file supports */
    linkedFormCodesJson: text("linkedFormCodesJson"),
    /** Client-visible note on the document */
    notes: text("notes"),
    /** Internal reviewer-only — excluded from client packet unless explicitly included */
    internalReviewerNotes: text("internalReviewerNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    profileIdx: index("accounting_doc_records_profile_idx").on(t.accountingProfileId),
  })
);

export const accountingQuarterlyWorkflows = mysqlTable(
  "accounting_quarterly_workflows",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    quarterLabel: varchar("quarterLabel", { length: 8 }).notNull(),
    checklistJson: text("checklistJson"),
    /** JSON: closeout checklist (statements, categorize, reconcile, receipts, payroll, estimates, notes ack) */
    closeoutJson: text("closeoutJson"),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    profileQuarterUidx: uniqueIndex("accounting_quarterly_profile_q_uidx").on(t.accountingProfileId, t.quarterLabel),
  })
);

export const accountingReadinessSnapshots = mysqlTable(
  "accounting_readiness_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    bookkeepingScore: int("bookkeepingScore").notNull(),
    missingDocumentsJson: text("missingDocumentsJson"),
    unresolvedItemsCount: int("unresolvedItemsCount").notNull().default(0),
    quarterReadinessJson: text("quarterReadinessJson"),
    yearEndStatus: varchar("yearEndStatus", { length: 32 }).notNull(),
    handoffPercent: int("handoffPercent").notNull(),
    computedAt: timestamp("computedAt").defaultNow().notNull(),
  },
  (t) => ({
    profileIdx: index("accounting_readiness_profile_idx").on(t.accountingProfileId),
  })
);

export const taxFormCandidates = mysqlTable(
  "tax_form_candidates",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    formCode: varchar("formCode", { length: 64 }).notNull(),
    displayName: varchar("displayName", { length: 512 }).notNull(),
    rationale: text("rationale"),
    supportNeededJson: text("supportNeededJson"),
    /** JSON string[] — discrete support items (W-9s, mileage log, etc.) */
    requiredRecordsJson: text("requiredRecordsJson"),
    /** JSON number[] — accounting_document_records.id */
    attachedDocumentIdsJson: text("attachedDocumentIdsJson"),
    /** JSON string[] — heuristic gaps vs required */
    missingSupportJson: text("missingSupportJson"),
    /** readiness heuristic: partial | missing_support | etc. */
    status: varchar("status", { length: 40 }).notNull().default("partial"),
    /** pending_review | supporting_attached | needs_followup | cleared */
    reviewerStatus: varchar("reviewerStatus", { length: 40 }).notNull().default("pending_review"),
    reviewerNotes: text("reviewerNotes"),
    /** open | resolved | waived | still_missing — support gap resolution */
    supportGapStatus: varchar("supportGapStatus", { length: 32 }).notNull().default("open"),
    supportGapNote: text("supportGapNote"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    profileIdx: index("tax_form_candidates_profile_idx").on(t.accountingProfileId),
    profileFormUidx: uniqueIndex("tax_form_candidates_profile_form_uidx").on(t.accountingProfileId, t.formCode),
  })
);

export const taxPreparerHandoffs = mysqlTable(
  "tax_preparer_handoffs",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    packetName: varchar("packetName", { length: 255 }).notNull(),
    summaryText: text("summaryText"),
    /** draft | ready_for_review | reviewed | exported */
    packetStatus: varchar("packetStatus", { length: 40 }).notNull().default("draft"),
    exportedFileUrl: varchar("exportedFileUrl", { length: 1024 }),
    probableFormsJson: text("probableFormsJson"),
    missingItemsJson: text("missingItemsJson"),
    preparerNotes: text("preparerNotes"),
    /** JSON HandoffComposition snapshot used for this packet */
    compositionJson: text("compositionJson"),
    bundleStorageKey: varchar("bundleStorageKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    profileIdx: index("tax_preparer_handoffs_profile_idx").on(t.accountingProfileId),
  })
);

export const accountingReviewItems = mysqlTable(
  "accounting_review_items",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    /** missing_document | document_review | ledger_unresolved | form_support_gap | incomplete_quarter | handoff_deficiency | manual */
    sourceType: varchar("sourceType", { length: 64 }).notNull(),
    /** Optional stable key e.g. doc id, form row id, quarter label */
    sourceId: varchar("sourceId", { length: 64 }),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    /** info | warning | blocker */
    severity: varchar("severity", { length: 16 }).notNull().default("warning"),
    /** open | in_progress | waiting_on_client | resolved | waived */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    /** client | reviewer | preparer | admin */
    assignedRole: varchar("assignedRole", { length: 32 }).notNull().default("reviewer"),
    dueAt: timestamp("dueAt"),
    resolutionNotes: text("resolutionNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  (t) => ({
    profileIdx: index("accounting_review_items_profile_idx").on(t.accountingProfileId),
    profileStatusIdx: index("accounting_review_items_profile_status_idx").on(t.accountingProfileId, t.status),
  })
);

export const accountingReviewNotes = mysqlTable(
  "accounting_review_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId").notNull(),
    relatedRecordType: varchar("relatedRecordType", { length: 64 }).notNull(),
    relatedRecordId: int("relatedRecordId").notNull(),
    authorRole: varchar("authorRole", { length: 32 }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    profileIdx: index("accounting_review_notes_profile_idx").on(t.accountingProfileId),
  })
);

export const accountingAuditLog = mysqlTable(
  "accounting_audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    accountingProfileId: int("accountingProfileId"),
    actorId: int("actorId"),
    actionType: varchar("actionType", { length: 100 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: varchar("entityId", { length: 64 }).notNull(),
    metadataJson: text("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    profileIdx: index("accounting_audit_log_profile_idx").on(t.accountingProfileId),
    actorIdx: index("accounting_audit_log_actor_idx").on(t.actorId),
  })
);
