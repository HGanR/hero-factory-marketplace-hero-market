/**
 * Aggregate counts for CSV import parse result.
 */

import type { CsvImportParseSummary, CsvImportResult } from "./csvTypes";

export function buildCsvImportSummary(result: CsvImportResult): CsvImportParseSummary {
  let errorCount = 0;
  let warningCount = 0;

  for (const m of result.summary.fileMessages) {
    if (m.severity === "error") errorCount++;
    else warningCount++;
  }

  for (const inv of result.invalidRows) {
    for (const msg of inv.messages) {
      if (msg.severity === "error") errorCount++;
      else warningCount++;
    }
  }

  for (const v of result.validRows) {
    warningCount += v.warnings.length;
  }

  return {
    totalDataRows: result.summary.totalDataRows,
    validCount: result.validRows.length,
    invalidCount: result.invalidRows.length,
    canonicalHeaders: result.summary.canonicalHeaders,
    fileMessages: result.summary.fileMessages,
    errorCount,
    warningCount,
  };
}
