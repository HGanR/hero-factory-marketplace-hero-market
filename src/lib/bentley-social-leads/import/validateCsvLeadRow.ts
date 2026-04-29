/**
 * Row-level validation for CSV import — errors block the row; warnings attach to valid rows.
 */

import type { LeadSourcePlatform } from "../engine/domainTypes";
import type { CsvNormalizedRow, CsvRowMessage } from "./csvTypes";

export type PlatformParseResult = {
  platform: LeadSourcePlatform;
  warnings: string[];
};

const KNOWN: Record<string, LeadSourcePlatform> = {
  tiktok: "tiktok",
  tik_tok: "tiktok",
  youtube: "youtube",
  yt: "youtube",
  reddit: "reddit",
  instagram: "instagram",
  ig: "instagram",
  facebook: "facebook_public",
  facebook_public: "facebook_public",
  fb: "facebook_public",
  meta: "facebook_public",
  craigslist: "craigslist_public",
  craigslist_public: "craigslist_public",
  unknown: "unknown",
};

/**
 * Parse platform cell into LeadSourcePlatform.
 * Unknown labels → `unknown` with a warning (row can still be valid if other fields ok).
 */
export function parsePlatformValue(raw: string): PlatformParseResult {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!t) {
    return { platform: "unknown", warnings: ["Platform missing — required."] };
  }
  const p = KNOWN[t];
  if (p) {
    return { platform: p, warnings: [] };
  }
  return {
    platform: "unknown",
    warnings: [`Unsupported platform "${raw.trim()}" — using unknown.`],
  };
}

const ISO_LIKE =
  /^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}|^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}/;

function validateTimestamp(raw: string): CsvRowMessage | null {
  if (!raw.trim()) return null;
  const t = raw.trim();
  const d = Date.parse(t);
  if (!Number.isFinite(d)) {
    return {
      text: `publishedAt "${t.slice(0, 80)}" is not a recognized date format.`,
      severity: "warning",
    };
  }
  if (!ISO_LIKE.test(t) && Number.isFinite(d)) {
    return {
      text: `publishedAt parsed (${new Date(d).toISOString()}) but format is non-standard.`,
      severity: "warning",
    };
  }
  return null;
}

function get(row: CsvNormalizedRow, k: string): string {
  return (row[k] ?? "").trim();
}

export function validateCsvLeadRow(row: CsvNormalizedRow, rowNumber: number): CsvRowMessage[] {
  const messages: CsvRowMessage[] = [];

  const platform = get(row, "platform");
  if (!platform) {
    messages.push({ text: "Missing required field: platform", severity: "error" });
  }

  const commentText = get(row, "commentText");
  if (!commentText) {
    messages.push({ text: "Missing required field: commentText", severity: "error" });
  } else if (commentText.length === 0) {
    messages.push({ text: "commentText is blank after trim", severity: "error" });
  }

  if (platform) {
    const pp = parsePlatformValue(platform);
    for (const w of pp.warnings) {
      messages.push({ text: w, severity: "warning" });
    }
  }

  const pub = get(row, "publishedAt");
  const tsMsg = validateTimestamp(pub);
  if (tsMsg) messages.push(tsMsg);

  const url = get(row, "sourceUrl");
  if (url && !/^https?:\/\//i.test(url) && !/^www\./i.test(url)) {
    messages.push({
      text: `sourceUrl may be invalid (expected http(s) URL): "${url.slice(0, 120)}"`,
      severity: "warning",
    });
  }

  return messages;
}

export function partitionMessages(messages: CsvRowMessage[]): {
  errors: CsvRowMessage[];
  warnings: CsvRowMessage[];
} {
  const errors = messages.filter((m) => m.severity === "error");
  const warnings = messages.filter((m) => m.severity === "warning");
  return { errors, warnings };
}
