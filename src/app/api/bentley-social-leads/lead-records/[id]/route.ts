import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { computeComparisonDeltas } from "@/lib/bentley-social-leads/computeComparisonDeltas";
import { leadAnalyses, leadAnalysisRuns, leadRecords } from "@/lib/db/schema.bentley-social-leads";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function analysisToPlain(row: typeof leadAnalyses.$inferSelect): Record<string, unknown> {
  return { ...row } as Record<string, unknown>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadRecordId } = await params;
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const compareRunId = url.searchParams.get("compareRunId");

  const db = await getDb();
  const [rec] = await db
    .select()
    .from(leadRecords)
    .where(and(eq(leadRecords.id, leadRecordId), eq(leadRecords.userId, userId)))
    .limit(1);

  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const analyses = runId
    ? await db
        .select()
        .from(leadAnalyses)
        .where(and(eq(leadAnalyses.leadRecordId, leadRecordId), eq(leadAnalyses.analysisRunId, runId)))
        .limit(1)
    : await db
        .select()
        .from(leadAnalyses)
        .where(eq(leadAnalyses.leadRecordId, leadRecordId))
        .orderBy(desc(leadAnalyses.analyzedAt))
        .limit(1);

  const analysis = analyses[0] ?? null;

  let comparisonAnalysis: typeof analysis = null;
  if (compareRunId && runId && compareRunId !== runId) {
    const [runOk] = await db
      .select({ id: leadAnalysisRuns.id })
      .from(leadAnalysisRuns)
      .where(
        and(
          eq(leadAnalysisRuns.id, compareRunId),
          eq(leadAnalysisRuns.uploadId, rec.uploadId),
          eq(leadAnalysisRuns.userId, userId)
        )
      )
      .limit(1);

    if (runOk) {
      const [c] = await db
        .select()
        .from(leadAnalyses)
        .where(and(eq(leadAnalyses.leadRecordId, leadRecordId), eq(leadAnalyses.analysisRunId, compareRunId)))
        .limit(1);
      comparisonAnalysis = c ?? null;
    }
  }

  let comparisonDeltas = null;
  if (analysis && comparisonAnalysis) {
    comparisonDeltas = computeComparisonDeltas(analysisToPlain(analysis), analysisToPlain(comparisonAnalysis));
  }

  return NextResponse.json({ record: rec, analysis, comparisonAnalysis, comparisonDeltas });
}
