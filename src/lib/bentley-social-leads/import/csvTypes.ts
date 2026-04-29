/**
 * Types for manual CSV import (public comment rows) — analysis / review only.
 */

import type { LeadRawRecord } from "../engine/domainTypes";

export type CsvMessageSeverity = "error" | "warning";

export type CsvRowMessage = {
  text: string;
  severity: CsvMessageSeverity;
};

/** One CSV line after header normalization (canonical keys, string values). */
export type CsvNormalizedRow = Record<string, string>;

export type CsvInvalidRow = {
  rowNumber: number;
  originalRow: CsvNormalizedRow;
  normalizedRow: CsvNormalizedRow;
  messages: CsvRowMessage[];
};

export type CsvValidRow = {
  rowNumber: number;
  record: LeadRawRecord;
  warnings: string[];
};

export type CsvImportParseSummary = {
  totalDataRows: number;
  validCount: number;
  invalidCount: number;
  errorCount: number;
  warningCount: number;
  canonicalHeaders: string[];
  /** Non-fatal: file readable but empty data, etc. */
  fileMessages: CsvRowMessage[];
};

export type CsvImportResult = {
  validRows: CsvValidRow[];
  invalidRows: CsvInvalidRow[];
  summary: CsvImportParseSummary;
};

/** Persisted on upload + echoed in rawPayloadJson for provenance. */
export type CsvImportBatchMeta = {
  importSource: "csv_upload";
  fileName: string;
  importedAt: string;
  /** Total lines attempted (including invalid) when operator chose valid-only import. */
  totalRowsAttempted?: number;
  validRowsImported: number;
  invalidRowsSkipped?: number;
};
