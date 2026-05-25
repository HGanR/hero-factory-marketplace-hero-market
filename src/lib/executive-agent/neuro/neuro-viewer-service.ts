import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { neuroDisclaimerForSubject } from "@/lib/executive-agent/neuro/neuro-governance";
import {
  getNeuroChunkById,
  getNeuroDocumentById,
  listNeuroChunksForDocument,
} from "@/lib/executive-agent/neuro/neuro-store";
import type { NeuroDocumentViewerDto, NeuroPassageCitationDto } from "@/lib/executive-agent/neuro/neuro-types";
import { listNeuroDocuments } from "@/lib/executive-agent/neuro/neuro-store";

type Db = MySql2Database<typeof schema>;

export async function buildNeuroDocumentViewerDto(
  db: Db,
  adminUserId: number,
  documentId: string,
  opts?: { chunkId?: string | null; highlightQuery?: string | null }
): Promise<NeuroDocumentViewerDto | null> {
  const docRow = await getNeuroDocumentById(db, adminUserId, documentId);
  if (!docRow) return null;

  const allDocs = await listNeuroDocuments(db, adminUserId);
  const doc = allDocs.find((d) => d.id === documentId);
  if (!doc) return null;

  const chunks = await listNeuroChunksForDocument(db, documentId);
  const fullText =
    chunks.length > 0
      ? chunks.map((c) => c.text).join("\n\n")
      : doc.extractedTextPreview;

  let citation: NeuroPassageCitationDto | null = null;
  let highlightChunkId = opts?.chunkId ?? null;

  if (opts?.chunkId) {
    const chunk = await getNeuroChunkById(db, opts.chunkId);
    if (chunk && chunk.documentId === documentId) {
      citation = {
        chunkId: chunk.id,
        documentId,
        documentTitle: doc.title,
        fileName: doc.fileName,
        citationLabel: chunk.citationLabel,
        sourceLocator: chunk.sourceLocator,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        snippet: chunk.text.slice(0, 400),
        highlightStart: 0,
        highlightEnd: Math.min(400, chunk.text.length),
        confidence: 1,
        subjectArea: doc.subjectArea,
        assignedAgent: doc.assignedAgent,
      };
    }
  } else if (opts?.highlightQuery && chunks.length) {
    const q = opts.highlightQuery.toLowerCase();
    const match = chunks.find((c) => c.text.toLowerCase().includes(q));
    if (match) {
      highlightChunkId = match.id;
      const idx = match.text.toLowerCase().indexOf(q);
      citation = {
        chunkId: match.id,
        documentId,
        documentTitle: doc.title,
        fileName: doc.fileName,
        citationLabel: match.citationLabel,
        sourceLocator: match.sourceLocator,
        pageNumber: match.pageNumber,
        sectionTitle: match.sectionTitle,
        snippet: match.text.slice(Math.max(0, idx - 40), idx + q.length + 120),
        highlightStart: Math.max(0, idx - 40),
        highlightEnd: idx + q.length + 120,
        confidence: 1,
        subjectArea: doc.subjectArea,
        assignedAgent: doc.assignedAgent,
      };
    }
  }

  const viewerMode =
    doc.sourceType === "pdf" ? "pdf" : fullText ? "text" : ("unsupported" as const);

  return {
    document: doc,
    chunks,
    viewerMode,
    fullText,
    storageUri: doc.storageUri,
    highlightChunkId,
    highlightPassage: citation?.snippet ?? null,
    citation,
    disclaimer: neuroDisclaimerForSubject(doc.subjectArea),
  };
}
