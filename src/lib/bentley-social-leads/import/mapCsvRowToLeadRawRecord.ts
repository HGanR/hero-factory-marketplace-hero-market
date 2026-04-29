/**
 * Map one normalized CSV row to LeadRawRecord (engine domain).
 */

import type { LeadRawRecord } from "../engine/domainTypes";
import type { LeadSourcePlatform } from "../engine/domainTypes";
import type { CsvNormalizedRow } from "./csvTypes";
import { parsePlatformValue } from "./validateCsvLeadRow";

function pick(row: CsvNormalizedRow, key: string): string {
  return (row[key] ?? "").trim();
}

/** Build stable source id for dedupe / provenance. */
export function buildSourceIdFromRow(row: CsvNormalizedRow, rowNumber: number): string {
  const explicit = pick(row, "sourceId") || pick(row, "postId");
  if (explicit) return explicit.slice(0, 512);
  return `csv-row-${rowNumber}`;
}

/**
 * Map validated row fields to LeadRawRecord.
 * Precondition: platform + commentText present (caller validates).
 */
export function mapCsvRowToLeadRawRecord(row: CsvNormalizedRow, rowNumber: number): LeadRawRecord {
  const { platform } = parsePlatformValue(pick(row, "platform"));
  const commentText = pick(row, "commentText");
  const authorHandle = pick(row, "authorHandle") || "unknown";
  const sourceId = buildSourceIdFromRow(row, rowNumber);

  const rawMeta: Record<string, unknown> = {};
  const vh = pick(row, "verticalHint");
  if (vh) rawMeta.verticalHint = vh;
  const adn = pick(row, "authorDisplayName");
  if (adn) rawMeta.authorDisplayName = adn;
  const lc = pick(row, "likeCount");
  if (lc && /^\d+$/.test(lc)) rawMeta.likeCount = parseInt(lc, 10);
  const rc = pick(row, "replyCount");
  if (rc && /^\d+$/.test(rc)) rawMeta.replyCount = parseInt(rc, 10);
  const pid = pick(row, "parentId");
  if (pid) rawMeta.parentId = pid;

  const st = pick(row, "sourceTitle");
  const su = pick(row, "sourceUrl");
  const pub = pick(row, "publishedAt");

  return {
    sourcePlatform: platform,
    sourceId,
    sourceTitle: st || undefined,
    sourceUrl: su || undefined,
    authorHandle: authorHandle.replace(/^@+/, "") || "unknown",
    commentText,
    postedAt: pub || undefined,
    rawMeta: Object.keys(rawMeta).length ? rawMeta : undefined,
  };
}

export function mapEnginePlatformToPipelinePlatform(p: LeadSourcePlatform): string {
  if (p === "facebook_public") return "facebook";
  if (p === "craigslist_public") return "craigslist";
  return p;
}
