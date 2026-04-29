export type KnowledgeChunk = {
  id: string;
  sourceName: string;
  text: string;
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreChunk(queryTokens: string[], chunkText: string): number {
  const text = chunkText.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (t.length < 2) continue;
    const hits = text.split(t).length - 1;
    if (hits > 0) score += 1 + Math.min(5, hits);
  }
  return score;
}

/** Split text into overlapping chunks of ~CHUNK_SIZE chars */
export function chunkText(text: string, sourceName: string, itemId: string): KnowledgeChunk[] {
  if (!text?.trim()) return [];
  const trimmed = text.trim();
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  let i = 0;
  while (start < trimmed.length) {
    let end = Math.min(start + CHUNK_SIZE, trimmed.length);
    if (end < trimmed.length) {
      const nextNewline = trimmed.indexOf("\n", end);
      const nextPeriod = trimmed.indexOf(". ", end);
      const softBreak = Math.min(
        nextNewline >= 0 ? nextNewline + 1 : trimmed.length,
        nextPeriod >= 0 ? nextPeriod + 2 : trimmed.length,
        end + 200
      );
      if (softBreak <= end + 300) end = softBreak;
    }
    const slice = trimmed.slice(start, end).trim();
    if (slice) {
      chunks.push({ id: `${itemId}-${i}`, sourceName, text: slice });
      i += 1;
    }
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
}

export function selectTopChunks(args: {
  query: string;
  chunks: KnowledgeChunk[];
  topK?: number;
  minScore?: number;
}): KnowledgeChunk[] {
  const { query, chunks, topK = 8, minScore = 1 } = args;
  const scored = selectTopChunksWithScores({ query, chunks, topK, minScore });
  return scored.map((x) => x.chunk);
}

/** Like selectTopChunks but returns chunks with scores (for debug) */
export function selectTopChunksWithScores(args: {
  query: string;
  chunks: KnowledgeChunk[];
  topK?: number;
  minScore?: number;
}): { chunk: KnowledgeChunk; score: number }[] {
  const { query, chunks, topK = 8, minScore = 1 } = args;
  if (!query.trim() || !chunks.length) return [];

  const q = tokenize(query);
  return chunks
    .map((c) => ({ chunk: c, score: scoreChunk(q, c.text) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Fallback: when no chunks score above minScore, return first N chunks by order */
export function selectTopChunksWithFallback(args: {
  query: string;
  chunks: KnowledgeChunk[];
  topK?: number;
}): KnowledgeChunk[] {
  const { query, chunks, topK = 8 } = args;
  const selected = selectTopChunks({ query, chunks, topK, minScore: 1 });
  if (selected.length > 0) return selected;
  return chunks.slice(0, topK);
}

export function buildKnowledgeContext(selected: KnowledgeChunk[]): string {
  if (!selected.length) return "";
  const parts = selected.map((c, i) => {
    const snippet = c.text.length > 1200 ? c.text.slice(0, 1200) + "…" : c.text;
    return `[#${i + 1}] ${c.sourceName}\n${snippet}`;
  });

  return `KNOWLEDGE CONTEXT (use this as primary source; if the answer is not here, say so)\n\n${parts.join("\n\n")}`;
}

type KnowledgeRow = {
  id: string;
  contentOrPointer: string | null;
  type: string;
};

function collectChunksFromRows(rows: KnowledgeRow[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const r of rows) {
    if (!r.contentOrPointer) continue;
    try {
      const j = JSON.parse(r.contentOrPointer) as Record<string, unknown>;
      let text = "";
      let name = r.id.slice(0, 8);
      if (r.type === "pdf") {
        text = (j?.extractedText ?? "").toString().trim();
        name = (j?.fileName as string) ?? "document";
      } else if (r.type === "note") {
        text = (j?.content ?? "").toString().trim();
        name = (j?.title as string) ?? "Note";
      } else if (r.type === "url" && typeof j?.url === "string") {
        text = `URL: ${j.url}`;
        name = j.url;
      } else if (r.type === "faq") {
        const items = (j?.items as Array<{ q?: string; a?: string }>) ?? [];
        text = items.map((p) => `Q: ${(p?.q ?? "").toString().trim()}\nA: ${(p?.a ?? "").toString().trim()}`).filter(Boolean).join("\n\n");
        name = (j?.title as string) ?? "FAQs";
        if (!text && typeof j?.extractedText === "string") text = j.extractedText;
      } else if (r.type === "web_crawler") {
        text = (j?.fetchedText ?? "").toString().trim() || `URL: ${(j?.url ?? "").toString()}`;
        name = (j?.url as string) ?? "Web page";
      } else if (r.type === "tables") {
        text = (j?.extractedText ?? "").toString().trim();
        if (!text && Array.isArray(j?.rows)) {
          text = (j.rows as unknown[][]).map((row) => (Array.isArray(row) ? row.join(" | ") : String(row))).join("\n");
        }
        name = (j?.title as string) ?? "Table";
      }
      if (text) chunks.push(...chunkText(text, name, r.id));
    } catch {
      /* skip malformed */
    }
  }
  return chunks;
}

/** Build retrieval-based knowledge context from DB rows and user message */
export function buildKnowledgeContextFromRows(
  rows: KnowledgeRow[],
  userMessage: string,
  topK = 8
): string {
  const chunks = collectChunksFromRows(rows);
  const selected = selectTopChunksWithFallback({ query: userMessage, chunks, topK });
  return buildKnowledgeContext(selected);
}

/**
 * Answer from knowledge only (no LLM). Returns top relevant chunk(s) as plain text.
 * Use when NPC_LLM_ENDPOINT is not configured — like Jarva's keyword→content flow.
 */
export function answerFromKnowledgeOnly(
  rows: KnowledgeRow[],
  userMessage: string,
  topK = 3
): string | null {
  const chunks = collectChunksFromRows(rows);
  if (!chunks.length) return null;
  const scored = selectTopChunksWithScores({ query: userMessage, chunks, topK, minScore: 0 });
  const selected = scored.length > 0 ? scored : chunks.slice(0, topK).map((c) => ({ chunk: c, score: 0 }));
  const parts = selected.map((x) => x.chunk.text.trim()).filter(Boolean);
  if (!parts.length) return null;
  return parts.join("\n\n---\n\n");
}

/** Same as buildKnowledgeContextFromRows but returns debug info about selected chunks */
export function buildKnowledgeContextFromRowsWithDebug(
  rows: KnowledgeRow[],
  userMessage: string,
  topK = 8
): { context: string; selectedChunks: { id: string; score: number; preview: string }[] } {
  const chunks = collectChunksFromRows(rows);
  const scored = selectTopChunksWithScores({ query: userMessage, chunks, topK, minScore: 1 });
  const selectedWithScores =
    scored.length > 0 ? scored : chunks.slice(0, topK).map((c) => ({ chunk: c, score: 0 }));
  const context = buildKnowledgeContext(selectedWithScores.map((x) => x.chunk));
  const debugChunks = selectedWithScores.map((x) => ({
    id: x.chunk.id,
    score: x.score,
    preview: x.chunk.text.slice(0, 120),
  }));
  return { context, selectedChunks: debugChunks };
}
