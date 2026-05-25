import { unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";
import type { NeuroSourceType } from "@/lib/executive-agent/neuro/neuro-types";

export type NeuroTextExtractionResult =
  | { ok: true; text: string; pageCount?: number }
  | { ok: false; reason: "unsupported_for_text" | "empty" | "failed"; message: string };

export async function extractNeuroDocumentText(
  buffer: Buffer,
  sourceType: NeuroSourceType,
  fileName: string
): Promise<NeuroTextExtractionResult> {
  try {
    switch (sourceType) {
      case "pdf":
        return await extractPdfText(buffer);
      case "txt":
      case "markdown":
        return extractPlainText(buffer);
      case "docx":
        return extractDocxText(buffer);
      case "doc":
        return {
          ok: false,
          reason: "unsupported_for_text",
          message: "Legacy .doc format is not supported in this slice — convert to PDF or DOCX.",
        };
      case "image":
        return {
          ok: false,
          reason: "unsupported_for_text",
          message: "Image documents are stored but OCR is not enabled in this slice.",
        };
      default:
        return {
          ok: false,
          reason: "unsupported_for_text",
          message: `Unsupported source type for text extraction: ${sourceType}`,
        };
    }
  } catch (e) {
    return {
      ok: false,
      reason: "failed",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function extractPdfText(buffer: Buffer): Promise<NeuroTextExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text ?? ""];
  const joined = pages
    .map((p, i) => (String(p).trim() ? `--- Page ${i + 1} ---\n${String(p).trim()}` : ""))
    .filter(Boolean)
    .join("\n\n");
  if (!joined.trim()) {
    return { ok: false, reason: "empty", message: "No extractable text in PDF (may be image-only)." };
  }
  return { ok: true, text: joined, pageCount: extracted.totalPages ?? pages.length };
}

function extractPlainText(buffer: Buffer): NeuroTextExtractionResult {
  const text = buffer.toString("utf8").replace(/\u0000/g, "").trim();
  if (!text) return { ok: false, reason: "empty", message: "Text file is empty." };
  return { ok: true, text };
}

function extractDocxText(buffer: Buffer): NeuroTextExtractionResult {
  const files = unzipSync(new Uint8Array(buffer));
  const docXml = files["word/document.xml"];
  if (!docXml) {
    return { ok: false, reason: "failed", message: "Invalid DOCX — missing word/document.xml." };
  }
  const xml = new TextDecoder("utf8").decode(docXml);
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) parts.push(m[1]);
  }
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty", message: "DOCX contained no extractable text." };
  return { ok: true, text };
}
