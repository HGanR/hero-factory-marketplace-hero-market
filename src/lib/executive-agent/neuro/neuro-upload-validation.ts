export const NEURO_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const NEURO_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/octet-stream",
]);

export function validateNeuroUploadFile(file: File): { ok: true } | { ok: false; code: string } {
  if (!file || file.size <= 0) return { ok: false, code: "MISSING_FILE" };
  if (file.size > NEURO_MAX_UPLOAD_BYTES) return { ok: false, code: "FILE_TOO_LARGE" };
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!NEURO_UPLOAD_MIME_TYPES.has(mime) && !file.name.match(/\.(pdf|txt|md|doc|docx)$/i)) {
    return { ok: false, code: "UNSUPPORTED_TYPE" };
  }
  return { ok: true };
}
