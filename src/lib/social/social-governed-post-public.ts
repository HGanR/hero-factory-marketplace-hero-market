import { inArray } from "drizzle-orm";
import { campaignAssets } from "@/lib/db/schema";
import type { campaignPosts } from "@/lib/db/schema";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";

export type SocialGovernedPostPublic = {
  id: string;
  campaignId: string;
  provider: string;
  /** Set when a campaign asset is linked (required for Instagram publish). */
  assetId: string | null;
  /** From `campaign_assets.creative_type` when joined (IMAGE, VIDEO, …). */
  assetCreativeType: string | null;
  socialAccountId: string | null;
  contentPreview: string;
  linkUrl: string | null;
  scheduledFor: string | null;
  /** Row status: DRAFT | SCHEDULED | … */
  status: string;
  approvalStatus: RevenueOsPublishApprovalStatus;
  publishStatus: SocialPublishStatusLabel;
  externalPostId: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SocialPublishStatusLabel =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "rejected"
  | "retry_scheduled";

function utmRecord(utmParams: unknown): Record<string, string> | null {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

export function rowStatusToPublishLabel(row: typeof campaignPosts.$inferSelect): SocialPublishStatusLabel {
  const st = String(row.status || "").toUpperCase();
  if (st === "POSTED") return "published";
  if (st === "PUBLISHING") return "publishing";
  if (st === "FAILED") return "failed";
  if (st === "RETRY_SCHEDULED") return "retry_scheduled";
  if (st === "SCHEDULED") return "scheduled";
  if (st === "DRAFT") return "draft";
  return "draft";
}

export type SocialGovernedPostPublicEnrich = {
  linkedAssetCreativeType?: string | null;
};

export function mapCampaignPostRowToSocialGovernedPublic(
  row: typeof campaignPosts.$inferSelect,
  enrich?: SocialGovernedPostPublicEnrich
): SocialGovernedPostPublic {
  const utm = utmRecord(row.utmParams);
  const workerReq = readScheduledPublishRequireApprovalEnv();
  const approvalStatus = resolveEffectiveApprovalStatus(workerReq, utm);
  const caption = row.caption ?? "";
  const contentPreview = caption.length > 160 ? `${caption.slice(0, 157)}…` : caption;

  return {
    id: row.id,
    campaignId: row.campaignId,
    provider: row.platform,
    assetId: row.assetId ?? null,
    assetCreativeType: enrich?.linkedAssetCreativeType ?? null,
    socialAccountId: row.socialAccountId ?? null,
    contentPreview,
    linkUrl: row.linkUrl ?? null,
    scheduledFor: row.scheduledAt instanceof Date ? row.scheduledAt.toISOString() : row.scheduledAt ? String(row.scheduledAt) : null,
    status: row.status,
    approvalStatus,
    publishStatus: rowStatusToPublishLabel(row),
    externalPostId: row.platformPostId ?? null,
    lastError: row.errorMessage ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ? String(row.updatedAt) : null,
  };
}

/** Batch-load `campaign_assets.creative_type` for public post payloads (no URLs). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchLinkedAssetCreativeTypeMap(db: any, assetIds: (string | null | undefined)[]): Promise<Record<string, string | null>> {
  const ids = [...new Set(assetIds.map((x) => String(x ?? "").trim()).filter(Boolean))] as string[];
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: campaignAssets.id, creativeType: campaignAssets.creativeType })
    .from(campaignAssets)
    .where(inArray(campaignAssets.id, ids));
  const m: Record<string, string | null> = {};
  for (const r of rows) {
    m[r.id] = r.creativeType ?? null;
  }
  return m;
}
