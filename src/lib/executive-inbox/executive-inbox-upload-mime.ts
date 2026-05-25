/** Normalize browser-reported MIME for Executive Inbox uploads (macOS often sends empty type for .zip). */

export function resolveExecutiveInboxUploadMime(
  mime: string | undefined,
  filename: string,
): string {
  const name = filename.trim().toLowerCase();
  let type = (mime ?? "").trim().toLowerCase();

  if (!type || type === "application/octet-stream") {
    if (name.endsWith(".zip")) return "application/zip";
    if (name.endsWith(".webm")) return "audio/webm";
    if (name.endsWith(".mp3")) return "audio/mpeg";
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".ogg")) return "audio/ogg";
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
  }

  return type || "application/octet-stream";
}

export function normalizeExecutiveInboxUploadFile(file: File): File {
  const type = resolveExecutiveInboxUploadMime(file.type, file.name);
  if (type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

export function pickExecutiveInboxMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const c of cands) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}
