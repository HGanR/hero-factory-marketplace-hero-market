import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { mapJoinedToLeadAnalysisRow } from "@/lib/bentley-social-leads/mapLeadAnalysisRow";
import type { LeadAnalysisRow } from "@/lib/bentley-social-leads/queryTypes";
import { analysesToCsv } from "@/lib/bentley-social-leads/exportCsv";
import { exportHandoffCsv } from "@/lib/bentley-social-leads/exportHandoffCsv";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadAnalyses, leadAnalysisRuns, leadRecords } from "@/lib/db/schema.bentley-social-leads";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

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

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const uploadId = searchParams.get("uploadId");
  const runId = searchParams.get("runId");
  const format = searchParams.get("format");
  if (!uploadId || !runId) {
    return NextResponse.json({ error: "uploadId and runId required" }, { status: 400 });
  }

  const db = await getDb();
  const joined = await db
    .select(selectFields)
    .from(leadAnalyses)
    .innerJoin(leadRecords, eq(leadAnalyses.leadRecordId, leadRecords.id))
    .innerJoin(leadAnalysisRuns, eq(leadAnalyses.analysisRunId, leadAnalysisRuns.id))
    .where(
      and(
        eq(leadRecords.uploadId, uploadId),
        eq(leadRecords.userId, userId),
        eq(leadAnalyses.analysisRunId, runId)
      )
    );

  const rows: LeadAnalysisRow[] = joined.map((r) => mapJoinedToLeadAnalysisRow(r));

  const handoff = format === "handoff";
  const csv = handoff ? exportHandoffCsv(rows) : analysesToCsv(rows);
  const filename = handoff
    ? `bentley-handoff-${uploadId.slice(0, 8)}-${runId.slice(0, 8)}.csv`
    : `bentley-sli-${uploadId.slice(0, 8)}-${runId.slice(0, 8)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
