import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Start a batch analysis run for an upload (public-surface heuristics only).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadAnalysisRuns, leadRecords, leadUploads } from "@/lib/db/schema.bentley-social-leads";
import type { NormalizedLead } from "@/lib/bentley-social-leads/types";
import { runLeadAnalysisPipeline } from "@/lib/bentley-social-leads/runLeadAnalysisPipeline";
import { insertLeadAnalysisRow, markRunComplete, persistRunSummarySnapshot } from "@/lib/bentley-social-leads/persistLeadAnalysis";
import { syncTrackedLeadsFromEngagementRun } from "@/lib/bentley-social-leads/syncTrackedLeadsFromEngagementRun";
import { BENTLEY_SLI_PIPELINE_VERSION } from "@/lib/bentley-social-leads/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_VERSION = "bentley-sli-v2";
const MAX_LEADS = 60;

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { uploadId?: string };
  const uploadId = body.uploadId?.trim();
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  const db = await getDb();
  const [up] = await db
    .select()
    .from(leadUploads)
    .where(and(eq(leadUploads.id, uploadId), eq(leadUploads.userId, userId)))
    .limit(1);

  if (!up) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  const records = await db
    .select()
    .from(leadRecords)
    .where(and(eq(leadRecords.uploadId, uploadId), eq(leadRecords.userId, userId)));

  if (records.length === 0) return NextResponse.json({ error: "No lead records for upload" }, { status: 400 });
  if (records.length > MAX_LEADS) {
    return NextResponse.json({ error: `Too many leads (max ${MAX_LEADS} per run).` }, { status: 400 });
  }

  const runId = randomUUID();
  const now = new Date();
  await db.insert(leadAnalysisRuns).values({
    id: runId,
    uploadId,
    userId,
    status: "running",
    modelVersion: MODEL_VERSION,
    pipelineVersion: BENTLEY_SLI_PIPELINE_VERSION,
    totalLeads: records.length,
    successCount: 0,
    failureCount: 0,
    startedAt: now,
  });

  let success = 0;
  let failure = 0;

  for (const rec of records) {
    try {
      const normalized = rec.normalizedPayloadJson as unknown as NormalizedLead;
      const raw = (rec.rawPayloadJson ?? {}) as Record<string, unknown>;
      const analysis = await runLeadAnalysisPipeline(normalized, raw);
      await insertLeadAnalysisRow(db, {
        leadRecordId: rec.id,
        analysisRunId: runId,
        analysis,
      });
      success++;
    } catch (e) {
      console.error("[bentley-sli] lead analysis error", rec.id, e);
      failure++;
    }
  }

  const status = failure === 0 ? "completed" : success === 0 ? "failed" : "partial";
  await markRunComplete(db, runId, success, failure, status);
  if (success > 0) {
    await persistRunSummarySnapshot(db, { runId, userId, uploadId });
    const rawMeta = (up.rawMetaJson ?? {}) as Record<string, unknown>;
    if (rawMeta.importKind === "engagement_post_response") {
      try {
        const synced = await syncTrackedLeadsFromEngagementRun(db, { runId, userId, uploadId });
        console.info("[bentley-sli] engagement tracked leads synced", { uploadId, runId, synced });
      } catch (e) {
        console.warn("[bentley-sli] syncTrackedLeadsFromEngagementRun failed", e);
      }
    }
  }

  return NextResponse.json({ runId, uploadId, status, successCount: success, failureCount: failure });
}
