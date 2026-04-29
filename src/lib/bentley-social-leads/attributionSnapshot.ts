/**
 * Immutable attribution snapshot for tracked leads (Phase 4E).
 * Stored once at sync / first link so later edits to deployments do not rewrite history.
 */

export const BENTLEY_ATTRIBUTION_SNAPSHOT_VERSION = 1 as const;

export type BentleyAttributionSnapshot = {
  schemaVersion: typeof BENTLEY_ATTRIBUTION_SNAPSHOT_VERSION;
  capturedAt: string;
  originatingPlatform: string;
  source: string;
  leadRecordId?: string;
  uploadId?: string;
  analysisRunId?: string;
  contentDeploymentId?: string;
  engagementIngest?: boolean;
  /** Top pain theme / recurring pain label at capture */
  painTheme?: string;
  commercialReadiness?: string;
  /** Best-effort snapshots from Bentley analysis (when available) */
  bestOfferAngle?: string | null;
  suggestedCommentAngle?: string | null;
  suggestedCtaAngle?: string | null;
  hookSnapshot?: string | null;
};

export function buildAttributionSnapshot(input: Omit<BentleyAttributionSnapshot, "schemaVersion" | "capturedAt"> & {
  capturedAt?: string;
}): BentleyAttributionSnapshot {
  return {
    schemaVersion: BENTLEY_ATTRIBUTION_SNAPSHOT_VERSION,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    originatingPlatform: input.originatingPlatform,
    source: input.source,
    leadRecordId: input.leadRecordId,
    uploadId: input.uploadId,
    analysisRunId: input.analysisRunId,
    contentDeploymentId: input.contentDeploymentId,
    engagementIngest: input.engagementIngest,
    painTheme: input.painTheme,
    commercialReadiness: input.commercialReadiness,
    bestOfferAngle: input.bestOfferAngle ?? undefined,
    suggestedCommentAngle: input.suggestedCommentAngle ?? undefined,
    suggestedCtaAngle: input.suggestedCtaAngle ?? undefined,
    hookSnapshot: input.hookSnapshot ?? undefined,
  };
}

export function snapshotToJson(s: BentleyAttributionSnapshot): Record<string, unknown> {
  return { ...s } as Record<string, unknown>;
}
