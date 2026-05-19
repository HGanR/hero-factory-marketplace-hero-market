import "server-only";

import { uploadBlobToIPFS } from "@/lib/storage";
import {
  buildExecutiveInboxAttachmentFromUpload,
  EXECUTIVE_INBOX_MAX_UPLOAD_BYTES,
  EXECUTIVE_INBOX_UPLOAD_MIME_TYPES,
  type ExecutiveInboxAttachment,
} from "@/lib/executive-agent/executive-inbox-attachments";

export async function serverUploadExecutiveInboxFile(file: File): Promise<ExecutiveInboxAttachment> {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("MISSING_FILE");
  }
  if (file.size > EXECUTIVE_INBOX_MAX_UPLOAD_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!EXECUTIVE_INBOX_UPLOAD_MIME_TYPES.has(mime)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ipfsUri = await uploadBlobToIPFS(file);
  return buildExecutiveInboxAttachmentFromUpload({ file, buffer, ipfsUri });
}
