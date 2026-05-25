/** Nextdoor-style neighborhood posts: keep uploads small for reliability. */
export const BENTLEY_NEXTDOOR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** TikTok long-form ceiling — actual platform limits vary; this blocks obvious oversize. */
export const BENTLEY_TIKTOK_VIDEO_MAX_BYTES = 500 * 1024 * 1024;

const TIKTOK_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

export type BentleyAssetUploadValidation =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Validates an upload for a campaign post platform before persisting `campaign_assets`.
 */
export function validateBentleyCampaignAssetUpload(input: {
  platform: string;
  file: Pick<File, "size" | "type" | "name">;
}): BentleyAssetUploadValidation {
  const p = input.platform.trim().toLowerCase();
  const { file } = input;

  if (p === "nextdoor" && file.size > BENTLEY_NEXTDOOR_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "NEXTDOOR_FILE_TOO_LARGE",
      message: `Nextdoor uploads must be ${Math.floor(BENTLEY_NEXTDOOR_MAX_UPLOAD_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }

  if (p === "tiktok" && file.type.startsWith("video/")) {
    if (!TIKTOK_VIDEO_TYPES.has(file.type)) {
      return {
        ok: false,
        code: "TIKTOK_VIDEO_FORMAT",
        message: "TikTok video uploads should be MP4 or MOV (QuickTime).",
      };
    }
    if (file.size > BENTLEY_TIKTOK_VIDEO_MAX_BYTES) {
      return {
        ok: false,
        code: "TIKTOK_FILE_TOO_LARGE",
        message: "Video exceeds the configured maximum size for TikTok uploads.",
      };
    }
  }

  return { ok: true };
}

export function inferCampaignCreativeType(file: Pick<File, "type">): "IMAGE" | "VIDEO" | "OTHER" {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("video/")) return "VIDEO";
  if (t.startsWith("image/")) return "IMAGE";
  return "OTHER";
}
