/**
 * Ingestion adapter interfaces — real connectors plug in later; compliance stays external.
 */

import type { LeadNormalizedRecord, LeadRawRecord } from "./domainTypes";

export type LeadIngestionAdapter = {
  id: string;
  /** Human-readable; no scraping promises in code paths. */
  description: string;
  normalize(record: LeadRawRecord): LeadNormalizedRecord;
};

export function normalizeLeadRawRecord(record: LeadRawRecord, connectorId: string): LeadNormalizedRecord {
  return {
    platform: record.sourcePlatform,
    sourceContext: record.sourceTitle ?? record.sourceId,
    sourceTitle: record.sourceTitle,
    authorHandle: record.authorHandle,
    commentText: record.commentText,
    postedAt: record.postedAt,
    provenance: {
      connectorId,
      ingestedAt: new Date().toISOString(),
      sourceUrl: record.sourceUrl,
      sourcePostId: record.sourceId,
    },
  };
}
