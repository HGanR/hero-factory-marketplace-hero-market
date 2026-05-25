import "server-only";

import { uploadBlobToIPFS } from "@/lib/storage";
import {
  buildExecutiveInboxAttachmentFromUpload,
  EXECUTIVE_INBOX_MAX_UPLOAD_BYTES,
  EXECUTIVE_INBOX_UPLOAD_MIME_TYPES,
  type ExecutiveInboxAttachment,
} from "@/lib/executive-agent/executive-inbox-attachments";
import {
  EXECUTIVE_INBOX_MAX_SITE_PROJECT_BYTES,
  isExecutiveInboxSiteProjectMime,
  probeSiteProjectZipBuffer,
} from "@/lib/executive-agent/executive-inbox-site-project";
import { resolveExecutiveInboxUploadMime } from "@/lib/executive-inbox/executive-inbox-upload-mime";

export async function serverUploadExecutiveInboxFile(file: File): Promise<ExecutiveInboxAttachment> {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("MISSING_FILE");
  }
  const mime = resolveExecutiveInboxUploadMime(file.type, file.name);
  const normalizedFile =
    mime === file.type
      ? file
      : new File([file], file.name, { type: mime, lastModified: file.lastModified });
  if (!EXECUTIVE_INBOX_UPLOAD_MIME_TYPES.has(mime)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  const isSiteProject = isExecutiveInboxSiteProjectMime(mime);
  const maxBytes = isSiteProject ? EXECUTIVE_INBOX_MAX_SITE_PROJECT_BYTES : EXECUTIVE_INBOX_MAX_UPLOAD_BYTES;
  if (normalizedFile.size > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }
  const buffer = Buffer.from(await normalizedFile.arrayBuffer());
  if (isSiteProject) {
    const probe = probeSiteProjectZipBuffer(buffer);
    if (!probe.valid) {
      throw new Error("SITE_PROJECT_INVALID");
    }
  }
  const ipfsUri = await uploadBlobToIPFS(normalizedFile);
  return buildExecutiveInboxAttachmentFromUpload({
    file: normalizedFile,
    buffer,
    ipfsUri,
    kind: isSiteProject ? "site_project" : undefined,
    projectType: isSiteProject ? "vercel_nextjs" : undefined,
  });
}
