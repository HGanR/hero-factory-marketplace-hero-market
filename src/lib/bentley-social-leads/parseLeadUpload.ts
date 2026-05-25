import { parseValidateCsvImport } from "@/lib/bentley-social-leads/import/parseCsvImport";
import { buildCsvImportSummary } from "@/lib/bentley-social-leads/import/buildCsvImportSummary";
import type { LeadRawRecord } from "@/lib/bentley-social-leads/engine/domainTypes";

export type SourceType = "csv" | "csv_sli" | "paste" | "txt";

export type ParsedLeadUpload = {
  rows: LeadRawRecord[];
  meta: Record<string, unknown>;
};

export async function parseLeadUpload(
  sourceType: SourceType,
  buffer: Buffer | null,
  textFallback: string,
  filename: string
): Promise<ParsedLeadUpload> {
  if (sourceType === "csv" || sourceType === "csv_sli") {
    const text = buffer ? buffer.toString("utf8") : textFallback;
    const r = parseValidateCsvImport(text);
    const summary = buildCsvImportSummary(r);
    return {
      rows: r.validRows.map((v) => v.record),
      meta: {
        filename,
        sourceType,
        ...summary,
        invalidRowsSkipped: r.invalidRows.length,
      },
    };
  }

  const raw = buffer ? buffer.toString("utf8") : textFallback;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows: LeadRawRecord[] = lines.map((line, i) => ({
    sourcePlatform: "unknown",
    sourceId: `paste-${i + 1}`,
    authorHandle: "unknown",
    commentText: line,
  }));
  return {
    rows,
    meta: { filename, sourceType, rowCount: rows.length },
  };
}
