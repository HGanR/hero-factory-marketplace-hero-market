/**
 * After an engagement-tagged upload run completes, upsert lightweight tracked leads from analyses.
 */

import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { getDb } from "@/lib/db";
import { bentleyTrackedLeads, leadAnalyses, leadRecords } from "@/lib/db/schema.bentley-social-leads";
import { buildAttributionSnapshot, snapshotToJson } from "@/lib/bentley-social-leads/attributionSnapshot";

type DbClient = Awaited<ReturnType<typeof getDb>>;

function firstPainType(painPoints: unknown): string {
  if (!Array.isArray(painPoints) || painPoints.length === 0) return "";
  const p = painPoints[0];
  if (typeof p === "string") return p.slice(0, 128);
  return "";
}

export async function syncTrackedLeadsFromEngagementRun(
  db: DbClient,
  params: { runId: string; userId: number; uploadId: string }
): Promise<number> {
  const analyses = await db
    .select({
      leadRecordId: leadAnalyses.leadRecordId,
      intentScore: leadAnalyses.intentScore,
      painPointsJson: leadAnalyses.painPointsJson,
      commercialReadiness: leadAnalyses.commercialReadiness,
      bestOfferAngle: leadAnalyses.bestOfferAngle,
      suggestedCommentAngle: leadAnalyses.suggestedCommentAngle,
    })
    .from(leadAnalyses)
    .where(eq(leadAnalyses.analysisRunId, params.runId));

  let n = 0;
  for (const a of analyses) {
    const [lr] = await db
      .select()
      .from(leadRecords)
      .where(and(eq(leadRecords.id, a.leadRecordId), eq(leadRecords.userId, params.userId)))
      .limit(1);
    if (!lr) continue;

    const painType = firstPainType(a.painPointsJson);
    const intentStr = String(a.intentScore ?? "0");
    const comment = (lr.notes ?? "").trim() || "(no comment text)";

    const snap = snapshotToJson(
      buildAttributionSnapshot({
        originatingPlatform: lr.platform,
        source: "engagement",
        leadRecordId: lr.id,
        uploadId: params.uploadId,
        analysisRunId: params.runId,
        engagementIngest: true,
        painTheme: painType || undefined,
        commercialReadiness: a.commercialReadiness ?? undefined,
        bestOfferAngle: a.bestOfferAngle,
        suggestedCommentAngle: a.suggestedCommentAngle,
        suggestedCtaAngle: a.suggestedCommentAngle,
        hookSnapshot: painType ? `pain:${painType}` : undefined,
      })
    );

    const [existing] = await db
      .select({ id: bentleyTrackedLeads.id })
      .from(bentleyTrackedLeads)
      .where(
        and(eq(bentleyTrackedLeads.userId, params.userId), eq(bentleyTrackedLeads.leadRecordId, lr.id))
      )
      .limit(1);

    if (existing) {
      await db
        .update(bentleyTrackedLeads)
        .set({
          comment,
          painType,
          intentScore: intentStr,
          analysisRunId: params.runId,
          uploadId: params.uploadId,
          commercialReadiness: a.commercialReadiness ?? null,
          attributionSnapshotJson: snap,
          source: "engagement",
          rawPayloadJson: {
            syncedFromEngagementRun: true,
            uploadId: params.uploadId,
            leadRecordId: lr.id,
          } as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(bentleyTrackedLeads.id, existing.id));
    } else {
      await db.insert(bentleyTrackedLeads).values({
        id: randomUUID(),
        userId: params.userId,
        platform: lr.platform,
        handle: lr.handle,
        comment,
        painType,
        intentScore: intentStr,
        status: "new",
        source: "engagement",
        leadRecordId: lr.id,
        analysisRunId: params.runId,
        uploadId: params.uploadId,
        commercialReadiness: a.commercialReadiness ?? null,
        attributionSnapshotJson: snap,
        rawPayloadJson: {
          syncedFromEngagementRun: true,
          uploadId: params.uploadId,
        },
      });
    }
    n++;
  }
  return n;
}
