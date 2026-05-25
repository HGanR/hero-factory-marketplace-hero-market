/**
 * Load flattened analysis rows for one upload + run (batch summary + export).
 */

import { and, eq } from "drizzle-orm";
import { mapJoinedToLeadAnalysisRow, type JoinedAnalysisFields } from "@/lib/bentley-social-leads/mapLeadAnalysisRow";
import type { LeadAnalysisRow } from "@/lib/bentley-social-leads/queryTypes";
import { leadAnalyses, leadAnalysisRuns, leadRecords } from "@/lib/db/schema.bentley-social-leads";

const selectFields = {
  leadRecordId: leadRecords.id,
  analysisId: leadAnalyses.id,
  businessName: leadRecords.businessName,
  platform: leadRecords.platform,
  handle: leadRecords.handle,
  email: leadRecords.email,
  websiteUrl: leadRecords.websiteUrl,
  pipelineVersion: leadAnalysisRuns.pipelineVersion,
  accessStatus: leadAnalyses.accessStatus,
  businessType: leadAnalyses.businessType,
  maturityStage: leadAnalyses.maturityStage,
  inferredVertical: leadAnalyses.inferredVertical,
  leadType: leadAnalyses.leadType,
  commercialReadiness: leadAnalyses.commercialReadiness,
  coverageJson: leadAnalyses.coverageJson,
  opportunityScore: leadAnalyses.opportunityScore,
  confidenceScore: leadAnalyses.confidenceScore,
  visibilityScore: leadAnalyses.visibilityScore,
  demandScore: leadAnalyses.demandScore,
  intentScore: leadAnalyses.intentScore,
  frictionScore: leadAnalyses.frictionScore,
  fitScore: leadAnalyses.fitScore,
  bestOfferAngle: leadAnalyses.bestOfferAngle,
  suggestedNextMove: leadAnalyses.suggestedNextMove,
  summary: leadAnalyses.summary,
  commentSummaryJson: leadAnalyses.commentSummaryJson,
  rawAnalysisJson: leadAnalyses.rawAnalysisJson,
  weakSpotsJson: leadAnalyses.weakSpotsJson,
  evidenceJson: leadAnalyses.evidenceJson,
  findingConfidenceJson: leadAnalyses.findingConfidenceJson,
  topLeadDriversJson: leadAnalyses.topLeadDriversJson,
  rankingDiagnosticsJson: leadAnalyses.rankingDiagnosticsJson,
  actionRationale: leadAnalyses.actionRationale,
  operatorOverrideLeadType: leadAnalyses.operatorOverrideLeadType,
  operatorOverrideCommercialReadiness: leadAnalyses.operatorOverrideCommercialReadiness,
  operatorOverrideBestOfferAngle: leadAnalyses.operatorOverrideBestOfferAngle,
  operatorOverrideWeakSpotsJson: leadAnalyses.operatorOverrideWeakSpotsJson,
  operatorOverrideLeadTypeReason: leadAnalyses.operatorOverrideLeadTypeReason,
  operatorOverrideCommercialReadinessReason: leadAnalyses.operatorOverrideCommercialReadinessReason,
  operatorOverrideBestOfferAngleReason: leadAnalyses.operatorOverrideBestOfferAngleReason,
  operatorOverrideWeakSpotsReason: leadAnalyses.operatorOverrideWeakSpotsReason,
  operatorFeedbackLeadType: leadAnalyses.operatorFeedbackLeadType,
  operatorFeedbackCommercialReadiness: leadAnalyses.operatorFeedbackCommercialReadiness,
  operatorFeedbackWeakSpots: leadAnalyses.operatorFeedbackWeakSpots,
  operatorFeedbackBestOfferAngle: leadAnalyses.operatorFeedbackBestOfferAngle,
  operatorStatus: leadAnalyses.operatorStatus,
  operatorPriority: leadAnalyses.operatorPriority,
  operatorNotes: leadAnalyses.operatorNotes,
  manuallyReviewedAt: leadAnalyses.manuallyReviewedAt,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadLeadAnalysisRowsForRun(
  db: any,
  userId: number,
  uploadId: string,
  runId: string
): Promise<LeadAnalysisRow[]> {
  const joined = await db
    .select(selectFields)
    .from(leadAnalyses)
    .innerJoin(leadRecords, eq(leadAnalyses.leadRecordId, leadRecords.id))
    .innerJoin(leadAnalysisRuns, eq(leadAnalyses.analysisRunId, leadAnalysisRuns.id))
    .where(
      and(eq(leadRecords.uploadId, uploadId), eq(leadRecords.userId, userId), eq(leadAnalyses.analysisRunId, runId))
    );
  return joined.map((r: JoinedAnalysisFields) => mapJoinedToLeadAnalysisRow(r));
}
