export function executiveInboxUploadErrorMessage(code: string | undefined, detail?: string): string {
  switch (code) {
    case "UNSUPPORTED_TYPE":
      return "That file type is not allowed.";
    case "FILE_TOO_LARGE":
      return "File is too large (12 MB for attachments, 50 MB for website project ZIPs).";
    case "SITE_PROJECT_INVALID":
      return "ZIP must be a Site Builder Vercel/Next.js export (package.json + app/) or include site.builder-schema.json.";
    case "MISSING_FILE":
      return "No file was selected.";
    case "Unauthorized":
      return "Session expired or you are not signed in as an executive admin. Refresh and try again.";
    case "UPLOAD_FAILED":
      return detail?.includes("PINATA") || detail?.includes("NFT_STORAGE")
        ? "Storage upload failed — IPFS (Pinata/NFT.Storage) may not be configured on this server."
        : detail?.trim()
          ? `Upload failed: ${detail}`
          : "Upload failed — check server storage (IPFS) configuration.";
    default:
      return detail?.trim() ? detail : "Upload failed.";
  }
}
