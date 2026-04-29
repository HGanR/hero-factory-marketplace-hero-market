/**
 * DB persistence helpers for analysis rows (used from API routes).
 */

import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { getDb } from "@/lib/db";
import { leadAnalyses, leadAnalysisRuns, leadUploads } from "@/lib/db/schema.bentley-social-leads";
import { computeBatchSummary } from "./computeBatchSummary";
import { loadLeadAnalysisRowsForRun } from "./loadLeadAnalysisRowsForRun";
import type { FullLeadAnalysis } from "./types";

type DbClient = Awaited<ReturnType<typeof getDb>>;

function scoreExplanationToJson(se: FullLeadAnalysis["scoreExplanations"]): Record<string, unknown> {
  return {
    visibility_score: se.visibility_score,
    demand_score: se.demand_score,
    intent_score: se.intent_score,
    friction_score: se.friction_score,
    fit_score: se.fit_score,
    opportunity_score: se.opportunity_score,
    top_positive_drivers: se.top_positive_drivers,
    top_negative_drivers: se.top_negative_drivers,
    confidence_rationale: se.confidence_rationale,
  };
}

function websiteGradeToJson(g: FullLeadAnalysis["websiteGrade"]): Record<string, unknown> | null {
  if (!g) return null;
  return {
    ctaClarityScore: g.ctaClarityScore,
    trustSignalScore: g.trustSignalScore,
    bookingFrictionScore: g.bookingFrictionScore,
    leadCaptureScore: g.leadCaptureScore,
    contactAccessibilityScore: g.contactAccessibilityScore,
    websiteGrade: g.websiteGrade,
    websiteGradeExplanation: g.websiteGradeExplanation,
  };
}

function coverageToJson(c: FullLeadAnalysis["coverageJson"]): Record<string, unknown> {
  return {
    profileCoverageScore: c.profileCoverageScore,
    postCoverageScore: c.postCoverageScore,
    commentCoverageScore: c.commentCoverageScore,
    websiteCoverageScore: c.websiteCoverageScore,
    overallCoverageScore: c.overallCoverageScore,
    coverageScore: c.coverageScore,
    notes: c.notes,
  };
}

export async function insertLeadAnalysisRow(
  db: DbClient,
  params: {
    leadRecordId: string;
    analysisRunId: string;
    analysis: FullLeadAnalysis;
  }
): Promise<string> {
  const id = randomUUID();
  const a = params.analysis;
  const se = a.scoreExplanations;

  await db.insert(leadAnalyses).values({
    id,
    leadRecordId: params.leadRecordId,
    analysisRunId: params.analysisRunId,
    accessStatus: a.accessStatus,
    confidenceScore: String(a.scores.confidenceScore),
    visibilityScore: String(a.scores.visibilityScore),
    demandScore: String(a.scores.demandScore),
    intentScore: String(a.scores.intentScore),
    frictionScore: String(a.scores.frictionScore),
    fitScore: String(a.scores.fitScore),
    opportunityScore: String(a.scores.opportunityScore),
    businessType: a.businessType,
    maturityStage: a.maturityStage,
    inferredVertical: a.inferredVertical,
    leadType: a.inferredLeadType,
    commercialReadiness: a.commercialReadiness,
    summary: a.summary,
    accountSummaryJson: a.accountSummary,
    contentSummaryJson: a.contentSummary,
    commentSummaryJson: a.commentIntelligenceSummary,
    strengthsJson: a.strengths,
    weakSpotsJson: a.weakSpots,
    painPointsJson: a.likelyPainPoints,
    repeatedBuyerQuestionsJson: a.repeatedBuyerQuestions,
    objectionThemesJson: a.objectionThemes,
    demandSignalsJson: a.demandSignals,
    bestOfferAngle: a.bestOfferAngle,
    suggestedCommentAngle: a.suggestedCommentAngle,
    suggestedFollowMessageAngle: a.suggestedFollowMessageAngle,
    suggestedEmailAngle: a.suggestedEmailAngle,
    suggestedNextMove: a.suggestedNextMove,
    riskNotesJson: a.riskNotes,
    rawAnalysisJson: {
      ...a.rawAnalysis,
      suggestedActionTags: a.suggestedActionTags,
      postClassifications: a.postClassifications,
      commercialCommentSignals: a.commercialCommentSignals,
      pipelineVersion: a.pipelineVersion,
    },
    scoreExplanationJson: scoreExplanationToJson(se),
    websiteGradeJson: websiteGradeToJson(a.websiteGrade),
    coverageJson: coverageToJson(a.coverageJson),
    evidenceJson: a.evidenceJson as unknown as Record<string, unknown>,
    findingConfidenceJson: a.findingConfidenceJson as unknown as Record<string, unknown>,
    topLeadDriversJson: a.topLeadDriversJson as unknown as Record<string, unknown>,
    rankingDiagnosticsJson: a.rankingDiagnosticsJson as unknown as Record<string, unknown>,
    actionRationale: a.actionRationale,
    operatorOverrideLeadType: null,
    operatorOverrideCommercialReadiness: null,
    operatorOverrideBestOfferAngle: null,
    operatorOverrideWeakSpotsJson: null,
    operatorOverrideLeadTypeReason: null,
    operatorOverrideCommercialReadinessReason: null,
    operatorOverrideBestOfferAngleReason: null,
    operatorOverrideWeakSpotsReason: null,
    operatorFeedbackLeadType: null,
    operatorFeedbackCommercialReadiness: null,
    operatorFeedbackWeakSpots: null,
    operatorFeedbackBestOfferAngle: null,
    operatorStatus: "new",
    operatorPriority: "normal",
    operatorNotes: null,
    manuallyReviewedAt: null,
  });

  return id;
}

export async function markRunComplete(
  db: DbClient,
  runId: string,
  success: number,
  failure: number,
  status: "completed" | "failed" | "partial"
): Promise<void> {
  await db
    .update(leadAnalysisRuns)
    .set({
      status,
      successCount: success,
      failureCount: failure,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadAnalysisRuns.id, runId));
}

/** Persist frozen `computeBatchSummary` for comparison UI (after run completion). */
export async function persistRunSummarySnapshot(
  db: DbClient,
  params: { runId: string; userId: number; uploadId: string }
): Promise<void> {
  const rows = await loadLeadAnalysisRowsForRun(db, params.userId, params.uploadId, params.runId);
  const summary = computeBatchSummary(rows);
  await db
    .update(leadAnalysisRuns)
    .set({
      summarySnapshotJson: summary as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(leadAnalysisRuns.id, params.runId));
}

export async function markUploadParsed(
  db: DbClient,
  uploadId: string,
  count: number
): Promise<void> {
  await db
    .update(leadUploads)
    .set({ status: "parsed", parsedCount: count, updatedAt: new Date() })
    .where(eq(leadUploads.id, uploadId));
}
