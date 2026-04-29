/**
 * Convert LeadRawRecord + import provenance into NormalizedLead + rawPayloadJson
 * for the existing Bentley SLI persistence and runLeadAnalysisPipeline.
 */

import type { LeadRawRecord } from "../engine/domainTypes";
import type { NormalizedLead } from "../types";
import type { CsvImportBatchMeta } from "./csvTypes";
import { mapEnginePlatformToPipelinePlatform } from "./mapCsvRowToLeadRawRecord";

const BENTLEY_CSV_IMPORT_SCHEMA = 1 as const;

export type BentleyCsvImportPayload = {
  schemaVersion: typeof BENTLEY_CSV_IMPORT_SCHEMA;
  importSource: "csv_upload";
  fileName: string;
  importedAt: string;
  rowNumber: number;
  commentText: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceId: string;
  sourcePlatform: string;
  authorHandle: string;
  authorDisplayName?: string;
  verticalHint?: string;
  postedAt?: string;
  parentId?: string;
  likeCount?: number;
  replyCount?: number;
};

function ensureUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  return `https://${t}`;
}

/** Prefer profile-like URLs for fetch; thread URLs still passed through for operator audit. */
export function pickProfileUrlForFetch(sourceUrl: string | undefined): string {
  if (!sourceUrl?.trim()) return "";
  return ensureUrl(sourceUrl);
}

export function leadRawRecordToNormalizedLead(record: LeadRawRecord): NormalizedLead {
  const display =
    (record.rawMeta?.authorDisplayName as string | undefined)?.trim() ||
    record.authorHandle ||
    "Imported lead";
  const platform = mapEnginePlatformToPipelinePlatform(record.sourcePlatform);
  const profileUrl = pickProfileUrlForFetch(record.sourceUrl);
  const vh = (record.rawMeta?.verticalHint as string | undefined)?.trim();
  const notesParts = [record.commentText, vh ? `vertical:${vh}` : ""].filter(Boolean);
  return {
    businessName: display,
    platform,
    handle: record.authorHandle,
    profileUrl,
    email: null,
    websiteUrl: null,
    notes: notesParts.join("\n\n"),
  };
}

export function buildBentleyCsvImportPayload(
  record: LeadRawRecord,
  meta: { fileName: string; importedAt: string; rowNumber: number }
): BentleyCsvImportPayload {
  const authorDisplayName = record.rawMeta?.authorDisplayName as string | undefined;
  const verticalHint = record.rawMeta?.verticalHint as string | undefined;
  const parentId = record.rawMeta?.parentId as string | undefined;
  const likeCount = record.rawMeta?.likeCount as number | undefined;
  const replyCount = record.rawMeta?.replyCount as number | undefined;

  return {
    schemaVersion: BENTLEY_CSV_IMPORT_SCHEMA,
    importSource: "csv_upload",
    fileName: meta.fileName,
    importedAt: meta.importedAt,
    rowNumber: meta.rowNumber,
    commentText: record.commentText,
    sourceTitle: record.sourceTitle,
    sourceUrl: record.sourceUrl,
    sourceId: record.sourceId,
    sourcePlatform: record.sourcePlatform,
    authorHandle: record.authorHandle,
    authorDisplayName: authorDisplayName?.trim() || undefined,
    verticalHint: verticalHint?.trim() || undefined,
    postedAt: record.postedAt,
    parentId,
    likeCount,
    replyCount,
  };
}

export function mergeRawPayloadWithCsvImport(
  base: Record<string, unknown>,
  bentley: BentleyCsvImportPayload
): Record<string, unknown> {
  return {
    ...base,
    bentleyCsvImport: bentley,
  };
}

/** Tag row-level provenance for post-response / engagement CSV (Phase 4D). */
export function mergeEngagementProvenance(
  base: Record<string, unknown>,
  meta: { contentDeploymentId?: string | null; ingestionKind: "engagement_post_response" }
): Record<string, unknown> {
  return {
    ...base,
    bentleyEngagementIngest: {
      ingestionKind: meta.ingestionKind,
      contentDeploymentId: meta.contentDeploymentId ?? undefined,
      taggedAt: new Date().toISOString(),
    },
  };
}

export function buildCsvImportBatchMeta(params: {
  fileName: string;
  importedAt: string;
  totalRowsAttempted: number;
  validRowsImported: number;
  invalidRowsSkipped: number;
}): CsvImportBatchMeta {
  return {
    importSource: "csv_upload",
    fileName: params.fileName,
    importedAt: params.importedAt,
    totalRowsAttempted: params.totalRowsAttempted,
    validRowsImported: params.validRowsImported,
    invalidRowsSkipped: params.invalidRowsSkipped,
  };
}
