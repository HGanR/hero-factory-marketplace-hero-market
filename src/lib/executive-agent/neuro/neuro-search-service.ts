import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { neuroDocumentChunks, neuroDocuments } from "@/lib/db/schema";
import {
  neuroDisclaimerForSubject,
  NEURO_NO_SOURCE_MESSAGE,
} from "@/lib/executive-agent/neuro/neuro-governance";
import {
  insertNeuroAccessLog,
  insertNeuroSourceCitation,
} from "@/lib/executive-agent/neuro/neuro-store";
import type {
  NeuroAssignedAgent,
  NeuroPassageCitationDto,
  NeuroSearchResultDto,
  NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";

type Db = MySql2Database<typeof schema>;

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 12);
}

function scoreChunk(text: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const low = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (low.includes(t)) score += 1;
  }
  return score / tokens.length;
}

function highlightRange(text: string, tokens: string[]): { start: number; end: number; snippet: string } {
  const low = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = low.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  const start = idx >= 0 ? Math.max(0, idx - 80) : 0;
  const end = Math.min(text.length, start + 320);
  const snippet = (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
  return { start, end, snippet };
}

export async function searchNeuroSources(
  db: Db,
  input: {
    adminUserId: number;
    query: string;
    subjectArea?: NeuroSubjectArea | null;
    assignedAgent?: NeuroAssignedAgent | null;
    limit?: number;
  }
): Promise<NeuroSearchResultDto> {
  const q = input.query.trim();
  const tokens = tokenizeQuery(q);
  const limit = input.limit ?? 8;

  await insertNeuroAccessLog(db, {
    adminUserId: input.adminUserId,
    action: "search",
    queryText: q,
    subjectArea: input.subjectArea ?? null,
    assignedAgent: input.assignedAgent ?? null,
  });

  if (!q) {
    return {
      query: q,
      hits: [],
      totalHits: 0,
      disclaimer: neuroDisclaimerForSubject(input.subjectArea ?? null),
      sourceBacked: false,
    };
  }

  const conditions = [
    eq(neuroDocuments.adminUserId, input.adminUserId),
    eq(neuroDocuments.status, "indexed"),
  ];
  if (input.subjectArea) conditions.push(eq(neuroDocuments.subjectArea, input.subjectArea));
  if (input.assignedAgent) conditions.push(eq(neuroDocuments.assignedAgent, input.assignedAgent));

  const rows = await db
    .select({
      chunkId: neuroDocumentChunks.id,
      documentId: neuroDocuments.id,
      documentTitle: neuroDocuments.title,
      fileName: neuroDocuments.fileName,
      subjectArea: neuroDocuments.subjectArea,
      assignedAgent: neuroDocuments.assignedAgent,
      chunkIndex: neuroDocumentChunks.chunkIndex,
      pageNumber: neuroDocumentChunks.pageNumber,
      sectionTitle: neuroDocumentChunks.sectionTitle,
      text: neuroDocumentChunks.text,
      citationLabel: neuroDocumentChunks.citationLabel,
      sourceLocator: neuroDocumentChunks.sourceLocator,
    })
    .from(neuroDocumentChunks)
    .innerJoin(neuroDocuments, eq(neuroDocumentChunks.documentId, neuroDocuments.id))
    .where(and(...conditions))
    .limit(500);

  const scored = rows
    .map((row) => {
      const confidence = tokens.length ? scoreChunk(row.text, tokens) : 0;
      const { start, end, snippet } = highlightRange(row.text, tokens);
      const hit: NeuroPassageCitationDto = {
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        fileName: row.fileName,
        citationLabel: row.citationLabel,
        sourceLocator: row.sourceLocator,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        snippet,
        highlightStart: start,
        highlightEnd: end,
        confidence,
        subjectArea: row.subjectArea as NeuroSubjectArea,
        assignedAgent: row.assignedAgent as NeuroAssignedAgent,
      };
      return hit;
    })
    .filter((h) => h.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  for (const hit of scored) {
    await insertNeuroSourceCitation(db, {
      adminUserId: input.adminUserId,
      documentId: hit.documentId,
      chunkId: hit.chunkId,
      queryText: q,
      citationLabel: hit.citationLabel,
      snippet: hit.snippet,
      confidence: hit.confidence,
      subjectArea: hit.subjectArea,
      assignedAgent: hit.assignedAgent,
    });
  }

  const disclaimer = neuroDisclaimerForSubject(input.subjectArea ?? scored[0]?.subjectArea ?? null);

  return {
    query: q,
    hits: scored,
    totalHits: scored.length,
    disclaimer,
    sourceBacked: scored.length > 0,
  };
}

export async function buildNeuroNetworkOverview(db: Db, adminUserId: number) {
  const { listNeuroDocuments, countNeuroDocumentsBySubject } = await import(
    "@/lib/executive-agent/neuro/neuro-store"
  );
  const { NEURO_BRAIN_REGIONS } = await import("@/lib/executive-agent/neuro/neuro-types");
  const counts = await countNeuroDocumentsBySubject(db, adminUserId);
  const documents = await listNeuroDocuments(db, adminUserId, { limit: 120 });
  const regions = NEURO_BRAIN_REGIONS.map((r) => {
    const c = counts.get(r.id) ?? { total: 0, indexed: 0 };
    return { ...r, documentCount: c.total, indexedCount: c.indexed };
  });
  return {
    ok: true as const,
    regions,
    documents,
    totalDocuments: documents.length,
    totalIndexed: documents.filter((d) => d.status === "indexed").length,
    generatedAt: new Date().toISOString(),
  };
}
