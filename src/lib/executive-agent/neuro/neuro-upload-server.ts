import "server-only";

import { uploadBlobToIPFS } from "@/lib/storage";
import {
  inferNeuroSourceType,
  mapSubjectToDefaultAgent,
  type NeuroAssignedAgent,
  type NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";
import {
  validateNeuroUploadFile,
} from "@/lib/executive-agent/neuro/neuro-upload-validation";

export { NEURO_MAX_UPLOAD_BYTES, NEURO_UPLOAD_MIME_TYPES, validateNeuroUploadFile } from "@/lib/executive-agent/neuro/neuro-upload-validation";

export async function uploadNeuroSourceFile(file: File): Promise<{ storageUri: string; buffer: Buffer }> {
  const v = validateNeuroUploadFile(file);
  if (!v.ok) throw new Error(v.code);
  const buffer = Buffer.from(await file.arrayBuffer());
  const storageUri = await uploadBlobToIPFS(file);
  return { storageUri, buffer };
}

export function resolveNeuroUploadMetadata(input: {
  title?: string | null;
  fileName: string;
  subjectArea?: NeuroSubjectArea | null;
  assignedAgent?: NeuroAssignedAgent | null;
}) {
  const subjectArea = input.subjectArea ?? "GENERAL";
  const assignedAgent = input.assignedAgent ?? mapSubjectToDefaultAgent(subjectArea);
  const title = (input.title?.trim() || input.fileName.replace(/\.[^.]+$/, "") || "NEURO source").slice(0, 500);
  return { title, subjectArea, assignedAgent };
}
