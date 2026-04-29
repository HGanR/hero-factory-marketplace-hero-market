import { z } from "zod";

/** Persisted on `metadata.siteBuilderAssets` — builder-linked uploads only. */
export const SiteBuilderAssetRecordSchema = z
  .object({
    assetId: z.string().uuid(),
    kind: z.enum(["image", "video"]),
    originalName: z.string(),
    mimeType: z.string(),
    /** Relative to `uploads/site-builder/` (e.g. `123/uuid.jpg`). Canonical field name. */
    storagePath: z.string().optional(),
    /** @deprecated Same as `storagePath`; kept for older saved schemas. */
    storageKey: z.string().optional(),
    /** App route for preview; optional when only bundling from disk. */
    publicUrl: z.string().optional(),
  })
  .refine((d) => Boolean(d.storagePath?.trim() || d.storageKey?.trim()), {
    message: "storagePath or storageKey is required",
  });

export type SiteBuilderAssetRecord = z.infer<typeof SiteBuilderAssetRecordSchema>;

/** Resolved relative path under `uploads/site-builder/`. */
export function siteBuilderAssetRelativeStoragePath(asset: SiteBuilderAssetRecord): string {
  return (asset.storagePath?.trim() || asset.storageKey?.trim() || "").trim();
}

export const SiteBuilderAssetMapSchema = z.record(z.string(), SiteBuilderAssetRecordSchema);

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4"]);

export function classifySiteBuilderUploadMime(mime: string): "image" | "video" | null {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  if (IMAGE_MIMES.has(m)) return "image";
  if (VIDEO_MIMES.has(m)) return "video";
  return null;
}

export function extForSiteBuilderMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  switch (m) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "video/mp4":
      return ".mp4";
    default:
      return null;
  }
}

/** Safe, unique name inside ZIP asset folders (no path chars). */
export function zipAssetBaseName(asset: SiteBuilderAssetRecord): string {
  const ext = extForSiteBuilderMime(asset.mimeType) || (asset.kind === "video" ? ".mp4" : ".bin");
  return `sb-${asset.assetId.slice(0, 8)}${ext}`;
}
