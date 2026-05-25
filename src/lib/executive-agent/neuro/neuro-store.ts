import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  neuroAccessLogs,
  neuroDocumentChunks,
  neuroDocuments,
  neuroSourceCitations,
} from "@/lib/db/schema";
import type {
  NeuroAssignedAgent,
  NeuroDocumentDto,
  NeuroDocumentStatus,
  NeuroSourceType,
  NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";
import { estimateTokens, neuroChunkToDto } from "@/lib/executive-agent/neuro/neuro-chunking";
import type { NeuroChunkInput } from "@/lib/executive-agent/neuro/neuro-chunking";

type Db = MySql2Database<typeof schema>;

export async function insertNeuroDocument(
  db: Db,
  row: {
    adminUserId: number;
    title: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageUri: string;
    assignedAgent: NeuroAssignedAgent;
    subjectArea: NeuroSubjectArea;
    sourceType: NeuroSourceType;
    status?: NeuroDocumentStatus;
    statusMessage?: string | null;
    extractedTextPreview?: string | null;
  }
): Promise<string> {
  const id = randomUUID();
  await db.insert(neuroDocuments).values({
    id,
    adminUserId: row.adminUserId,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageUri: row.storageUri,
    assignedAgent: row.assignedAgent,
    subjectArea: row.subjectArea,
    sourceType: row.sourceType,
    status: row.status ?? "uploaded",
    statusMessage: row.statusMessage ?? null,
    extractedTextPreview: row.extractedTextPreview ?? null,
  });
  return id;
}

export async function updateNeuroDocumentStatus(
  db: Db,
  documentId: string,
  adminUserId: number,
  patch: {
    status: NeuroDocumentStatus;
    statusMessage?: string | null;
    extractedTextPreview?: string | null;
  }
): Promise<void> {
  await db
    .update(neuroDocuments)
    .set({
      status: patch.status,
      statusMessage: patch.statusMessage ?? null,
      extractedTextPreview: patch.extractedTextPreview ?? null,
    })
    .where(and(eq(neuroDocuments.id, documentId), eq(neuroDocuments.adminUserId, adminUserId)));
}

export async function getNeuroDocumentById(
  db: Db,
  adminUserId: number,
  documentId: string
): Promise<(typeof neuroDocuments.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(neuroDocuments)
    .where(and(eq(neuroDocuments.id, documentId), eq(neuroDocuments.adminUserId, adminUserId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listNeuroDocuments(
  db: Db,
  adminUserId: number,
  filters?: { subjectArea?: NeuroSubjectArea; assignedAgent?: NeuroAssignedAgent; limit?: number }
): Promise<NeuroDocumentDto[]> {
  const conditions = [eq(neuroDocuments.adminUserId, adminUserId)];
  if (filters?.subjectArea) conditions.push(eq(neuroDocuments.subjectArea, filters.subjectArea));
  if (filters?.assignedAgent) conditions.push(eq(neuroDocuments.assignedAgent, filters.assignedAgent));

  const rows = await db
    .select()
    .from(neuroDocuments)
    .where(and(...conditions))
    .orderBy(desc(neuroDocuments.updatedAt))
    .limit(filters?.limit ?? 200);

  const ids = rows.map((r) => r.id);
  const counts = await chunkCountsByDocumentIds(db, ids);

  return rows.map((r) => documentRowToDto(r, counts.get(r.id) ?? 0));
}

async function chunkCountsByDocumentIds(db: Db, documentIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!documentIds.length) return m;
  const rows = await db
    .select({
      documentId: neuroDocumentChunks.documentId,
      c: sql<number>`count(*)`.mapWith(Number),
    })
    .from(neuroDocumentChunks)
    .where(inArray(neuroDocumentChunks.documentId, documentIds))
    .groupBy(neuroDocumentChunks.documentId);
  for (const row of rows) m.set(row.documentId, row.c);
  return m;
}

function documentRowToDto(
  r: typeof neuroDocuments.$inferSelect,
  chunkCount: number
): NeuroDocumentDto {
  return {
    id: r.id,
    title: r.title,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    storageUri: r.storageUri,
    assignedAgent: r.assignedAgent as NeuroAssignedAgent,
    subjectArea: r.subjectArea as NeuroSubjectArea,
    sourceType: r.sourceType as NeuroSourceType,
    status: r.status as NeuroDocumentStatus,
    statusMessage: r.statusMessage,
    extractedTextPreview: r.extractedTextPreview,
    chunkCount,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    updatedAt: r.updatedAt?.toISOString?.() ?? String(r.updatedAt),
  };
}

export async function replaceNeuroDocumentChunks(
  db: Db,
  documentId: string,
  chunks: NeuroChunkInput[]
): Promise<void> {
  await db.delete(neuroDocumentChunks).where(eq(neuroDocumentChunks.documentId, documentId));
  if (!chunks.length) return;
  await db.insert(neuroDocumentChunks).values(
    chunks.map((c) => ({
      id: randomUUID(),
      documentId,
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber ?? null,
      sectionTitle: c.sectionTitle ?? null,
      text: c.text,
      tokenEstimate: estimateTokens(c.text),
      citationLabel: c.citationLabel,
      sourceLocator: c.sourceLocator,
    }))
  );
}

export async function listNeuroChunksForDocument(db: Db, documentId: string) {
  const rows = await db
    .select()
    .from(neuroDocumentChunks)
    .where(eq(neuroDocumentChunks.documentId, documentId))
    .orderBy(neuroDocumentChunks.chunkIndex);
  return rows.map(neuroChunkToDto);
}

export async function getNeuroChunkById(db: Db, chunkId: string) {
  const rows = await db.select().from(neuroDocumentChunks).where(eq(neuroDocumentChunks.id, chunkId)).limit(1);
  return rows[0] ?? null;
}

export async function insertNeuroSourceCitation(
  db: Db,
  row: {
    adminUserId: number;
    documentId: string;
    chunkId?: string | null;
    queryText: string;
    citationLabel: string;
    snippet: string;
    confidence: number;
    subjectArea?: string | null;
    assignedAgent?: string | null;
  }
): Promise<string> {
  const id = randomUUID();
  await db.insert(neuroSourceCitations).values({
    id,
    adminUserId: row.adminUserId,
    documentId: row.documentId,
    chunkId: row.chunkId ?? null,
    queryText: row.queryText,
    citationLabel: row.citationLabel,
    snippet: row.snippet,
    confidence: String(Math.min(1, Math.max(0, row.confidence)).toFixed(4)),
    subjectArea: row.subjectArea ?? null,
    assignedAgent: row.assignedAgent ?? null,
  });
  return id;
}

export async function insertNeuroAccessLog(
  db: Db,
  row: {
    adminUserId: number;
    action: string;
    queryText?: string | null;
    subjectArea?: string | null;
    assignedAgent?: string | null;
    documentId?: string | null;
    metadataJson?: Record<string, unknown> | null;
  }
): Promise<void> {
  await db.insert(neuroAccessLogs).values({
    id: randomUUID(),
    adminUserId: row.adminUserId,
    action: row.action,
    queryText: row.queryText ?? null,
    subjectArea: row.subjectArea ?? null,
    assignedAgent: row.assignedAgent ?? null,
    documentId: row.documentId ?? null,
    metadataJson: row.metadataJson ? JSON.stringify(row.metadataJson) : null,
  });
}

export async function countNeuroDocumentsBySubject(
  db: Db,
  adminUserId: number
): Promise<Map<NeuroSubjectArea, { total: number; indexed: number }>> {
  const rows = await db
    .select({
      subjectArea: neuroDocuments.subjectArea,
      status: neuroDocuments.status,
      c: sql<number>`count(*)`.mapWith(Number),
    })
    .from(neuroDocuments)
    .where(eq(neuroDocuments.adminUserId, adminUserId))
    .groupBy(neuroDocuments.subjectArea, neuroDocuments.status);

  const m = new Map<NeuroSubjectArea, { total: number; indexed: number }>();
  for (const row of rows) {
    const subject = row.subjectArea as NeuroSubjectArea;
    const cur = m.get(subject) ?? { total: 0, indexed: 0 };
    cur.total += row.c;
    if (row.status === "indexed") cur.indexed += row.c;
    m.set(subject, cur);
  }
  return m;
}
