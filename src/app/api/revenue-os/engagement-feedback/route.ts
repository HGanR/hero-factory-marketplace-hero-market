import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4D — Read frozen batch summary hints for an engagement upload/run (manual automation; informs next content batch).
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadAnalysisRuns, leadUploads } from "@/lib/db/schema.bentley-social-leads";
import { hintsFromSummarySnapshot } from "@/lib/bentley-social-leads/buildEngagementFeedbackHints";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId")?.trim();

  const db = await getDb();

  if (uploadId) {
    const [up] = await db
      .select()
      .from(leadUploads)
      .where(eq(leadUploads.id, uploadId))
      .limit(1);
    if (!up || up.userId !== userId) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }
    const raw = (up.rawMetaJson ?? {}) as Record<string, unknown>;
    if (raw.importKind !== "engagement_post_response") {
      return NextResponse.json({ error: "Not an engagement import" }, { status: 400 });
    }
    const [run] = await db
      .select()
      .from(leadAnalysisRuns)
      .where(eq(leadAnalysisRuns.uploadId, uploadId))
      .orderBy(desc(leadAnalysisRuns.completedAt))
      .limit(1);
    if (!run?.summarySnapshotJson) {
      return NextResponse.json({
        hints: hintsFromSummarySnapshot(null, { uploadId }),
        note: "Run analysis first — no summary snapshot yet.",
      });
    }
    const hints = hintsFromSummarySnapshot(run.summarySnapshotJson as Record<string, unknown>, {
      runId: run.id,
      uploadId,
    });
    return NextResponse.json({ hints, runId: run.id, uploadId });
  }

  const uploads = await db
    .select({ id: leadUploads.id, rawMetaJson: leadUploads.rawMetaJson })
    .from(leadUploads)
    .where(eq(leadUploads.userId, userId))
    .orderBy(desc(leadUploads.uploadedAt))
    .limit(40);

  const engagementUpload = uploads.find((u) => {
    const r = u.rawMetaJson as Record<string, unknown> | null | undefined;
    return r?.importKind === "engagement_post_response";
  });

  if (!engagementUpload) {
    return NextResponse.json({ hints: hintsFromSummarySnapshot(null), note: "No engagement imports yet." });
  }

  const [run] = await db
    .select()
    .from(leadAnalysisRuns)
    .where(eq(leadAnalysisRuns.uploadId, engagementUpload.id))
    .orderBy(desc(leadAnalysisRuns.completedAt))
    .limit(1);

  if (!run?.summarySnapshotJson) {
    return NextResponse.json({
      hints: hintsFromSummarySnapshot(null, { uploadId: engagementUpload.id }),
      uploadId: engagementUpload.id,
      note: "Run analysis on the engagement upload to populate hints.",
    });
  }

  const hints = hintsFromSummarySnapshot(run.summarySnapshotJson as Record<string, unknown>, {
    runId: run.id,
    uploadId: engagementUpload.id,
  });
  return NextResponse.json({ hints, runId: run.id, uploadId: engagementUpload.id });
}
