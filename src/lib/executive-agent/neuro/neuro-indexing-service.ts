import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { chunkNeuroDocumentText } from "@/lib/executive-agent/neuro/neuro-chunking";
import { extractNeuroDocumentText } from "@/lib/executive-agent/neuro/neuro-text-extract";
import {
  getNeuroDocumentById,
  insertNeuroAccessLog,
  replaceNeuroDocumentChunks,
  updateNeuroDocumentStatus,
} from "@/lib/executive-agent/neuro/neuro-store";
import type { NeuroSourceType } from "@/lib/executive-agent/neuro/neuro-types";

type Db = MySql2Database<typeof schema>;

export async function indexNeuroDocumentFromBuffer(
  db: Db,
  input: {
    adminUserId: number;
    documentId: string;
    buffer: Buffer;
    sourceType: NeuroSourceType;
    fileName: string;
  }
): Promise<{ ok: boolean; status: "indexed" | "failed" | "unsupported_for_text"; message?: string; chunkCount: number }> {
  const doc = await getNeuroDocumentById(db, input.adminUserId, input.documentId);
  if (!doc) return { ok: false, status: "failed", message: "document_not_found", chunkCount: 0 };

  await updateNeuroDocumentStatus(db, input.documentId, input.adminUserId, {
    status: "processing",
    statusMessage: "Extracting and chunking source text…",
  });

  const extracted = await extractNeuroDocumentText(input.buffer, input.sourceType, input.fileName);
  if (!extracted.ok) {
    const status = extracted.reason === "unsupported_for_text" ? "unsupported_for_text" : "failed";
    await updateNeuroDocumentStatus(db, input.documentId, input.adminUserId, {
      status,
      statusMessage: extracted.message,
    });
    await insertNeuroAccessLog(db, {
      adminUserId: input.adminUserId,
      action: "index_failed",
      documentId: input.documentId,
      metadataJson: { reason: extracted.reason, message: extracted.message },
    });
    return { ok: false, status, message: extracted.message, chunkCount: 0 };
  }

  const chunks = chunkNeuroDocumentText(extracted.text, { fileName: input.fileName });
  await replaceNeuroDocumentChunks(db, input.documentId, chunks);
  const preview = extracted.text.slice(0, 1200);
  await updateNeuroDocumentStatus(db, input.documentId, input.adminUserId, {
    status: "indexed",
    statusMessage: null,
    extractedTextPreview: preview,
  });
  await insertNeuroAccessLog(db, {
    adminUserId: input.adminUserId,
    action: "index_complete",
    documentId: input.documentId,
    metadataJson: { chunkCount: chunks.length },
  });
  return { ok: true, status: "indexed", chunkCount: chunks.length };
}

/** Re-fetch stored file from IPFS/HTTPS and re-index (best-effort). */
export async function reindexNeuroDocument(db: Db, adminUserId: number, documentId: string) {
  const doc = await getNeuroDocumentById(db, adminUserId, documentId);
  if (!doc) return { ok: false as const, error: "not_found" };
  const res = await fetch(doc.storageUri);
  if (!res.ok) {
    await updateNeuroDocumentStatus(db, documentId, adminUserId, {
      status: "failed",
      statusMessage: `Could not fetch stored file (${res.status}).`,
    });
    return { ok: false as const, error: "fetch_failed" };
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return indexNeuroDocumentFromBuffer(db, {
    adminUserId,
    documentId,
    buffer,
    sourceType: doc.sourceType as NeuroSourceType,
    fileName: doc.fileName,
  });
}
