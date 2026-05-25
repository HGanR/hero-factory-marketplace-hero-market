import type { LeadRawRecord } from "@/lib/bentley-social-leads/engine/domainTypes";
import { leadRawRecordToNormalizedLead } from "@/lib/bentley-social-leads/import/csvToPipeline";
import type { NormalizedLead } from "@/lib/bentley-social-leads/types";
import { parsePlatformValue } from "@/lib/bentley-social-leads/import/validateCsvLeadRow";

export function normalizeLeadRecord(raw: unknown): NormalizedLead {
  if (raw && typeof raw === "object" && "commentText" in raw) {
    return leadRawRecordToNormalizedLead(raw as LeadRawRecord);
  }
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const commentText = String(o.commentText ?? o.text ?? "").trim() || "(empty)";
  const authorHandle = String(o.authorHandle ?? o.handle ?? "unknown").trim() || "unknown";
  const platformCell = String(o.platform ?? "").trim();
  const { platform } = parsePlatformValue(platformCell);
  const rec: LeadRawRecord = {
    sourcePlatform: platform,
    sourceId: String(o.sourceId ?? "import-row"),
    authorHandle,
    commentText,
    sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : undefined,
    sourceTitle: typeof o.sourceTitle === "string" ? o.sourceTitle : undefined,
    postedAt: typeof o.postedAt === "string" ? o.postedAt : undefined,
    rawMeta: o.rawMeta && typeof o.rawMeta === "object" ? (o.rawMeta as Record<string, unknown>) : undefined,
  };
  return leadRawRecordToNormalizedLead(rec);
}
