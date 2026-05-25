/**
 * Validate + map CSV text into `LeadRawRecord` rows (Bentley SLI import).
 */

import type { CsvImportResult, CsvInvalidRow, CsvNormalizedRow, CsvValidRow } from "./csvTypes";
import { buildCsvImportSummary } from "./buildCsvImportSummary";
import { mapCsvRowToLeadRawRecord } from "./mapCsvRowToLeadRawRecord";
import { normalizeCsvHeaderRow } from "./normalizeCsvHeaders";
import { parseCsvText } from "./parseCsvText";
import { validateCsvLeadRow } from "./validateCsvLeadRow";

function rowObject(headers: string[], cells: string[]): CsvNormalizedRow {
  const row: CsvNormalizedRow = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    row[h] = (cells[i] ?? "").trim();
  }
  return row;
}

/**
 * Parse CSV string into validated engine records. Empty / whitespace-only files yield file-level messages.
 */
export function parseValidateCsvImport(rawFileText: string): CsvImportResult {
  const trimmed = rawFileText.trim();
  const fileMessages: CsvImportResult["summary"]["fileMessages"] = [];

  if (!trimmed) {
    fileMessages.push({ text: "CSV file is empty.", severity: "error" });
    const empty: CsvImportResult = {
      validRows: [],
      invalidRows: [],
      summary: {
        totalDataRows: 0,
        validCount: 0,
        invalidCount: 0,
        errorCount: 0,
        warningCount: 0,
        canonicalHeaders: [],
        fileMessages,
      },
    };
    return { ...empty, summary: buildCsvImportSummary(empty) };
  }

  const { headers, rows } = parseCsvText(trimmed);
  if (!headers.length) {
    fileMessages.push({ text: "CSV has no header row.", severity: "error" });
    const empty: CsvImportResult = {
      validRows: [],
      invalidRows: [],
      summary: {
        totalDataRows: 0,
        validCount: 0,
        invalidCount: 0,
        errorCount: 0,
        warningCount: 0,
        canonicalHeaders: [],
        fileMessages,
      },
    };
    return { ...empty, summary: buildCsvImportSummary(empty) };
  }

  const canonicalHeaders = normalizeCsvHeaderRow(headers);
  const validRows: CsvValidRow[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  rows.forEach((cells, idx) => {
    const rowNumber = idx + 2;
    const normalizedRow = rowObject(canonicalHeaders, cells);
    const messages = validateCsvLeadRow(normalizedRow, rowNumber);
    const hasError = messages.some((m) => m.severity === "error");
    if (hasError) {
      invalidRows.push({ rowNumber, originalRow: normalizedRow, normalizedRow, messages });
      return;
    }
    const record = mapCsvRowToLeadRawRecord(normalizedRow, rowNumber);
    const warnings = messages.filter((m) => m.severity === "warning").map((m) => m.text);
    validRows.push({ rowNumber, record, warnings });
  });

  const partial: CsvImportResult = {
    validRows,
    invalidRows,
    summary: {
      totalDataRows: rows.length,
      validCount: 0,
      invalidCount: 0,
      errorCount: 0,
      warningCount: 0,
      canonicalHeaders,
      fileMessages,
    },
  };
  return { ...partial, summary: buildCsvImportSummary(partial) };
}
