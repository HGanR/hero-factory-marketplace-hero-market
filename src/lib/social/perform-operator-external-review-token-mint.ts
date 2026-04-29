import crypto from "crypto";
import { campaignExternalSocialReviewTokens } from "@/lib/db/schema";
import {
  buildExternalReviewLinkMintedDetails,
  EXTERNAL_REVIEW_LINK_MINTED_ACTION,
  insertExternalReviewLinkAuditEvent,
  resolveExternalReviewAuditPostId,
} from "@/lib/social/external-social-review-audit";
import {
  allowedRolesJsonForInsert,
  generateExternalSocialReviewTokenRaw,
  hashExternalSocialReviewTokenRaw,
  normalizeExternalReviewAllowedRoles,
} from "@/lib/social/external-social-review-token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function computeSocialReviewTokenOrigin(req: { headers: Headers; url: string }): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host && !host.includes("localhost")) {
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export type OperatorExternalReviewMintResult = {
  id: string;
  rawToken: string;
  reviewUrl: string;
  expiresAt: Date | null;
  roles: ("editor" | "approver" | "owner")[];
  label: string | null;
};

/**
 * Insert token row, emit mint audit, return raw token + review URL (operator-only).
 */
export async function performOperatorExternalReviewTokenMint(args: {
  db: Db;
  userId: number;
  campaignId: string;
  origin: string;
  label?: string | null;
  expiresInDays?: number;
  allowedRoles?: ("editor" | "approver" | "owner")[];
  contextPostId?: string | null;
}): Promise<OperatorExternalReviewMintResult> {
  const { db, userId, campaignId, origin } = args;
  const raw = generateExternalSocialReviewTokenRaw();
  const tokenHash = hashExternalSocialReviewTokenRaw(raw);
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt =
    args.expiresInDays != null ? new Date(now.getTime() + args.expiresInDays * 86400_000) : null;
  const roles = normalizeExternalReviewAllowedRoles(args.allowedRoles);
  const label = args.label?.trim() || null;

  await db.insert(campaignExternalSocialReviewTokens).values({
    id,
    campaignId,
    tokenHash,
    createdByUserId: String(userId),
    label,
    allowedRolesJson: allowedRolesJsonForInsert(roles),
    expiresAt,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const auditPostId = await resolveExternalReviewAuditPostId(db, campaignId, args.contextPostId);
  await insertExternalReviewLinkAuditEvent({
    db,
    userId,
    postId: auditPostId,
    action: EXTERNAL_REVIEW_LINK_MINTED_ACTION,
    details: buildExternalReviewLinkMintedDetails({
      tokenId: id,
      label,
      expiresAt: expiresAt?.toISOString() ?? null,
      allowedRoles: roles,
    }),
  });

  const base = origin.replace(/\/$/, "");
  const reviewUrl = `${base}/review/social-publish?t=${encodeURIComponent(raw)}`;

  return {
    id,
    rawToken: raw,
    reviewUrl,
    expiresAt,
    roles,
    label,
  };
}
