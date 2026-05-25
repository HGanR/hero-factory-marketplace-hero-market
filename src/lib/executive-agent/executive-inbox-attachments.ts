import { randomUUID } from "crypto";
import { z } from "zod";
import { toGateway } from "@/lib/storage";
import { ipfsToHttp } from "@/lib/marketplace/pinata";

export const EXECUTIVE_INBOX_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const EXECUTIVE_INBOX_MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX = 62_000;

export const EXECUTIVE_INBOX_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

export type ExecutiveInboxAttachmentKind = "file" | "audio" | "site_project";

export type ExecutiveInboxAttachment = {
  id: string;
  kind: ExecutiveInboxAttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  /** Present when kind is site_project — helps recipients open in Site Builder. */
  projectType?: "vercel_nextjs";
};

const AttachmentInputSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["file", "audio", "site_project"]),
  filename: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string().url().max(2000),
  projectType: z.enum(["vercel_nextjs"]).optional(),
});

const AttachmentsArraySchema = z.array(AttachmentInputSchema).max(EXECUTIVE_INBOX_MAX_ATTACHMENTS_PER_MESSAGE);

export function validateExecutiveInboxAttachmentsArray(raw: unknown): ExecutiveInboxAttachment[] | null {
  const arr = AttachmentsArraySchema.safeParse(raw);
  if (!arr.success) return null;
  const out: ExecutiveInboxAttachment[] = [];
  for (const a of arr.data) {
    if (!isSafeExecutiveInboxAttachmentUrl(a.url)) return null;
    if (!EXECUTIVE_INBOX_UPLOAD_MIME_TYPES.has(a.mimeType.toLowerCase())) return null;
    const maxBytes =
      a.kind === "site_project"
        ? 50 * 1024 * 1024
        : EXECUTIVE_INBOX_MAX_UPLOAD_BYTES;
    if (a.sizeBytes > maxBytes) return null;
    out.push({
      id: a.id,
      kind: a.kind,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      url: a.url,
      ...(a.projectType ? { projectType: a.projectType } : {}),
    });
  }
  return out;
}

/** True when URL is an https link to a known IPFS gateway path (defense-in-depth for stored refs). */
export function isSafeExecutiveInboxAttachmentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!u.pathname.startsWith("/ipfs/")) return false;
    const rest = u.pathname.slice("/ipfs/".length);
    if (!rest || rest.includes("/")) return false;
    if (!/^[a-zA-Z0-9]+$/.test(rest)) return false;
    if (host === "nftstorage.link") return true;
    if (host === "gateway.pinata.cloud") return true;
    if (host.endsWith(".mypinata.cloud")) return true;
    return false;
  } catch {
    return false;
  }
}

export function parseAndValidateExecutiveInboxAttachmentsJson(raw: unknown): ExecutiveInboxAttachment[] | null {
  if (raw == null) return null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  return validateExecutiveInboxAttachmentsArray(parsed);
}

export function serializeExecutiveInboxAttachments(attachments: ExecutiveInboxAttachment[]): string {
  return JSON.stringify(attachments).slice(0, EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX);
}

export function ipfsUriToExecutiveInboxPublicUrl(ipfsUri: string): string {
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri;
  if ((process.env.PINATA_JWT || "").trim()) {
    return ipfsToHttp(ipfsUri);
  }
  return toGateway(ipfsUri);
}

export function buildExecutiveInboxAttachmentFromUpload(opts: {
  file: File;
  buffer: Buffer;
  ipfsUri: string;
  kind?: ExecutiveInboxAttachmentKind;
  projectType?: "vercel_nextjs";
}): ExecutiveInboxAttachment {
  const mime = (opts.file.type || "application/octet-stream").toLowerCase();
  const kind: ExecutiveInboxAttachmentKind =
    opts.kind ??
    (mime.startsWith("audio/") ? "audio" : mime.includes("zip") ? "site_project" : "file");
  const name =
    typeof opts.file.name === "string" && opts.file.name.trim()
      ? opts.file.name.trim().slice(0, 240)
      : kind === "audio"
        ? "voice-note.webm"
        : kind === "site_project"
          ? "site-project.zip"
          : "attachment";
  return {
    id: randomUUID(),
    kind,
    filename: name,
    mimeType: mime,
    sizeBytes: opts.buffer.length,
    url: ipfsUriToExecutiveInboxPublicUrl(opts.ipfsUri),
    ...(kind === "site_project" ? { projectType: opts.projectType ?? "vercel_nextjs" } : {}),
  };
}
