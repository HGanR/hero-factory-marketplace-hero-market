import crypto from "crypto";
import { eq } from "drizzle-orm";
import { campaignAuditEvents, campaignPosts } from "@/lib/db/schema";

export const EXTERNAL_REVIEW_LINK_MINTED_ACTION = "external_review_link_minted" as const;
export const EXTERNAL_REVIEW_LINK_REVOKED_ACTION = "external_review_link_revoked" as const;
export const EXTERNAL_REVIEW_LINK_EMAIL_SENT_ACTION = "external_review_link_email_sent" as const;
export const EXTERNAL_REVIEW_LINKS_BULK_REVOKED_ACTION = "external_review_links_bulk_revoked" as const;

/** Max length for varchar platform column. */
export const EXTERNAL_REVIEW_AUDIT_PLATFORM = "ext_review" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function resolveExternalReviewAuditPostId(
  db: Db,
  campaignId: string,
  contextPostId: string | undefined | null
): Promise<string | null> {
  const id = contextPostId?.trim();
  if (!id) return null;
  const rows = await db.select({ id: campaignPosts.id, campaignId: campaignPosts.campaignId }).from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
  const p = rows[0];
  if (!p || p.campaignId !== campaignId) return null;
  return p.id;
}

export async function insertExternalReviewLinkAuditEvent(args: {
  db: Db;
  userId: number;
  postId: string | null;
  action:
    | typeof EXTERNAL_REVIEW_LINK_MINTED_ACTION
    | typeof EXTERNAL_REVIEW_LINK_REVOKED_ACTION
    | typeof EXTERNAL_REVIEW_LINK_EMAIL_SENT_ACTION
    | typeof EXTERNAL_REVIEW_LINKS_BULK_REVOKED_ACTION;
  details: Record<string, unknown>;
}): Promise<void> {
  await args.db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: String(args.userId),
    postId: args.postId ?? null,
    action: args.action,
    platform: EXTERNAL_REVIEW_AUDIT_PLATFORM,
    details: args.details,
  });
}

export function buildExternalReviewLinkMintedDetails(args: {
  tokenId: string;
  label: string | null;
  expiresAt: string | null;
  allowedRoles: string[];
}): Record<string, unknown> {
  return {
    source: "operator_api",
    reviewSurface: "operator_token_lifecycle",
    tokenId: args.tokenId,
    label: args.label,
    expiresAt: args.expiresAt,
    allowedRoles: args.allowedRoles,
  };
}

export function buildExternalReviewLinkRevokedDetails(args: {
  tokenId: string;
  label: string | null;
  allowedRoles: string[];
}): Record<string, unknown> {
  return {
    source: "operator_api",
    reviewSurface: "operator_token_lifecycle",
    tokenId: args.tokenId,
    label: args.label,
    allowedRoles: args.allowedRoles,
  };
}

export function buildExternalReviewLinkEmailSentDetails(args: {
  tokenId: string;
  label: string | null;
  recipientEmail: string;
  subject: string;
}): Record<string, unknown> {
  return {
    source: "operator_api",
    reviewSurface: "operator_token_lifecycle",
    tokenId: args.tokenId,
    label: args.label,
    recipientEmail: args.recipientEmail,
    subject: args.subject,
  };
}

export function buildExternalReviewLinksBulkRevokedDetails(args: {
  campaignId: string;
  mode: string;
  revokedCount: number;
  revokedTokenIds: string[];
  /** When the action was triggered from a post detail surface (mirrors resolved timeline post when valid). */
  contextPostId?: string | null;
}): Record<string, unknown> {
  const cappedIds = args.revokedTokenIds.slice(0, 25);
  const out: Record<string, unknown> = {
    source: "operator_api",
    reviewSurface: "operator_token_lifecycle",
    campaignId: args.campaignId,
    mode: args.mode,
    revokedCount: args.revokedCount,
    revokedTokenIds: cappedIds,
    truncated: args.revokedTokenIds.length > cappedIds.length,
  };
  const ctx = args.contextPostId?.trim();
  if (ctx) out.contextPostId = ctx;
  return out;
}
