/**
 * Normalize outcome PATCH payloads: status transitions + timestamp defaults.
 */

const STATUSES = new Set(["new", "contacted", "booked", "closed", "lost"]);

export type OutcomePatchInput = {
  status?: string;
  painType?: string;
  intentScore?: number;
  contactedAt?: string | null;
  bookedAt?: string | null;
  closedAt?: string | null;
  lostAt?: string | null;
  estimatedValue?: number | null;
  closedValue?: number | null;
  outcomeNotes?: string | null;
  lossReason?: string | null;
  attributionConfidence?: number | null;
  contentDeploymentId?: string | null;
  uploadId?: string | null;
  leadRecordId?: string | null;
  analysisRunId?: string | null;
  commercialReadiness?: string | null;
  attributionSnapshotJson?: Record<string, unknown> | null;
};

export function normalizeOutcomePatch(body: OutcomePatchInput): {
  patch: Record<string, unknown>;
  error?: string;
} {
  if (body.status != null && !STATUSES.has(body.status)) {
    return { patch: {}, error: "Invalid status" };
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const now = new Date();

  if (body.status != null) patch.status = body.status;

  if (body.painType != null) patch.painType = String(body.painType).slice(0, 128);
  if (body.intentScore != null && Number.isFinite(body.intentScore)) patch.intentScore = String(body.intentScore);
  if (body.estimatedValue !== undefined) {
    patch.estimatedValue =
      body.estimatedValue != null && Number.isFinite(body.estimatedValue) ? String(body.estimatedValue) : null;
  }
  if (body.closedValue !== undefined) {
    patch.closedValue =
      body.closedValue != null && Number.isFinite(body.closedValue) ? String(body.closedValue) : null;
  }
  if (body.outcomeNotes !== undefined) patch.outcomeNotes = body.outcomeNotes;
  if (body.lossReason !== undefined) patch.lossReason = body.lossReason ? String(body.lossReason).slice(0, 512) : null;
  if (body.attributionConfidence != null && Number.isFinite(body.attributionConfidence)) {
    patch.attributionConfidence = String(Math.min(1, Math.max(0, body.attributionConfidence)));
  }
  if (body.contentDeploymentId !== undefined) patch.contentDeploymentId = body.contentDeploymentId?.trim() || null;
  if (body.uploadId !== undefined) patch.uploadId = body.uploadId?.trim() || null;
  if (body.leadRecordId !== undefined) patch.leadRecordId = body.leadRecordId?.trim() || null;
  if (body.analysisRunId !== undefined) patch.analysisRunId = body.analysisRunId?.trim() || null;
  if (body.commercialReadiness !== undefined) {
    patch.commercialReadiness = body.commercialReadiness ? String(body.commercialReadiness).slice(0, 32) : null;
  }
  if (body.attributionSnapshotJson !== undefined) patch.attributionSnapshotJson = body.attributionSnapshotJson;

  if (body.contactedAt !== undefined) patch.contactedAt = body.contactedAt ? new Date(body.contactedAt) : null;
  if (body.bookedAt !== undefined) patch.bookedAt = body.bookedAt ? new Date(body.bookedAt) : null;
  if (body.closedAt !== undefined) patch.closedAt = body.closedAt ? new Date(body.closedAt) : null;
  if (body.lostAt !== undefined) patch.lostAt = body.lostAt ? new Date(body.lostAt) : null;

  if (body.status === "contacted" && patch.contactedAt === undefined) patch.contactedAt = now;
  if (body.status === "booked" && patch.bookedAt === undefined) patch.bookedAt = now;
  if (body.status === "closed" && patch.closedAt === undefined) patch.closedAt = now;
  if (body.status === "lost" && patch.lostAt === undefined) patch.lostAt = now;

  return { patch };
}
