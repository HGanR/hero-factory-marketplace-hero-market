import type { NeuroChunkDto } from "@/lib/executive-agent/neuro/neuro-types";

export type NeuroChunkInput = {
  chunkIndex: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  text: string;
  citationLabel: string;
  sourceLocator: string;
};

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 120;

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Split extracted document text into overlapping chunks for citation indexing. */
export function chunkNeuroDocumentText(
  fullText: string,
  opts?: { chunkSize?: number; overlap?: number; fileName?: string }
): NeuroChunkInput[] {
  const chunkSize = opts?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts?.overlap ?? DEFAULT_OVERLAP;
  const normalized = fullText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: NeuroChunkInput[] = [];
  let buffer = "";
  let chunkIndex = 0;

  const flush = (sectionTitle?: string | null) => {
    const t = buffer.trim();
    if (!t) return;
    const pageNumber = inferPageFromSection(sectionTitle ?? undefined);
    const label = buildCitationLabel(opts?.fileName, chunkIndex, pageNumber, sectionTitle);
    out.push({
      chunkIndex,
      pageNumber,
      sectionTitle: sectionTitle ?? null,
      text: t,
      citationLabel: label,
      sourceLocator: pageNumber != null ? `page:${pageNumber}` : `chunk:${chunkIndex}`,
    });
    chunkIndex += 1;
    buffer = t.length > overlap ? t.slice(-overlap) : "";
  };

  for (const para of paragraphs) {
    const sectionTitle = para.startsWith("#") ? para.replace(/^#+\s*/, "").slice(0, 120) : null;
    const body = sectionTitle ? para.replace(/^#+\s*[^\n]+\n?/, "").trim() || para : para;
    if ((buffer + "\n\n" + body).length <= chunkSize) {
      buffer = buffer ? `${buffer}\n\n${body}` : body;
      continue;
    }
    flush(sectionTitle);
    if (body.length <= chunkSize) {
      buffer = body;
    } else {
      for (let i = 0; i < body.length; i += chunkSize - overlap) {
        const slice = body.slice(i, i + chunkSize);
        buffer = buffer ? `${buffer}\n\n${slice}` : slice;
        if (buffer.length >= chunkSize * 0.85) flush(sectionTitle);
      }
    }
  }
  flush(null);
  return out;
}

function inferPageFromSection(sectionTitle?: string): number | null {
  if (!sectionTitle) return null;
  const m = sectionTitle.match(/page\s*(\d+)/i);
  if (m) return Number.parseInt(m[1]!, 10);
  return null;
}

function buildCitationLabel(
  fileName: string | undefined,
  chunkIndex: number,
  pageNumber: number | null,
  sectionTitle: string | null | undefined
): string {
  const base = fileName ?? "source";
  if (pageNumber != null) return `${base} · p.${pageNumber}`;
  if (sectionTitle) return `${base} · ${sectionTitle.slice(0, 80)}`;
  return `${base} · §${chunkIndex + 1}`;
}

export function neuroChunkToDto(row: {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  text: string;
  tokenEstimate: number;
  citationLabel: string;
  sourceLocator: string;
}): NeuroChunkDto {
  return {
    id: row.id,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    pageNumber: row.pageNumber,
    sectionTitle: row.sectionTitle,
    text: row.text,
    tokenEstimate: row.tokenEstimate,
    citationLabel: row.citationLabel,
    sourceLocator: row.sourceLocator,
  };
}
