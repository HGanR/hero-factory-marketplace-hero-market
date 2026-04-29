/**
 * Best-effort projection of `campaign_assets.metadata` JSON for composer/API (no secrets).
 */

export type CampaignAssetMetadataProjection = {
  mimeType: string | null;
  extension: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

/**
 * Accepts common shapes: { mimeType, width, height, durationSeconds, extension } or nested dimensions.
 */
export function projectCampaignAssetMetadata(metadata: unknown): CampaignAssetMetadataProjection {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { mimeType: null, extension: null, width: null, height: null, durationSeconds: null };
  }
  const o = metadata as Record<string, unknown>;
  const width = num(o.width) ?? num(o.w) ?? (o.dimensions && typeof o.dimensions === "object" && !Array.isArray(o.dimensions)
    ? num((o.dimensions as Record<string, unknown>).width)
    : null);
  const height = num(o.height) ?? num(o.h) ?? (o.dimensions && typeof o.dimensions === "object" && !Array.isArray(o.dimensions)
    ? num((o.dimensions as Record<string, unknown>).height)
    : null);
  return {
    mimeType: str(o.mimeType) ?? str(o.contentType) ?? str(o.mime),
    extension: str(o.extension) ?? str(o.ext),
    width,
    height,
    durationSeconds: num(o.durationSeconds) ?? num(o.duration) ?? num(o.lengthSeconds),
  };
}
