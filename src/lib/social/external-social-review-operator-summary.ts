import type { campaignPosts, CampaignRow } from "@/lib/db/schema";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import { parseExternalReviewAllowedRolesJson } from "@/lib/social/external-social-review-token";
import { campaignPostVisibleOnExternalSocialReviewQueue } from "@/lib/social/external-social-publish-approval";

export type ExternalReviewTokenOperatorStatus = "active" | "expired" | "revoked";

export type ExternalReviewTokenOperatorRow = {
  id: string;
  label: string | null;
  allowedRoles: ("editor" | "approver" | "owner")[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: ExternalReviewTokenOperatorStatus;
  /** Operator user id who minted the token (internal reference, not shown to clients). */
  createdByUserId: string;
};

export type LastExternalClientReviewSummary = {
  at: string;
  /** Normalized from audit action */
  decision: "approved" | "rejected";
  postId: string | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

export function resolveExternalReviewTokenOperatorStatus(row: {
  revokedAt: Date | string | null | undefined;
  expiresAt: Date | string | null | undefined;
}): ExternalReviewTokenOperatorStatus {
  if (row.revokedAt != null) return "revoked";
  if (row.expiresAt != null) {
    const t = row.expiresAt instanceof Date ? row.expiresAt.getTime() : new Date(row.expiresAt).getTime();
    if (Number.isFinite(t) && t < Date.now()) return "expired";
  }
  return "active";
}

export function mapTokenRowToOperatorRow(row: {
  id: string;
  label: string | null;
  allowedRolesJson: unknown;
  createdByUserId: string;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}): ExternalReviewTokenOperatorRow {
  const allowedRoles = parseExternalReviewAllowedRolesJson(row.allowedRolesJson);
  return {
    id: row.id,
    label: row.label,
    allowedRoles,
    createdByUserId: String(row.createdByUserId),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    expiresAt: iso(row.expiresAt),
    revokedAt: iso(row.revokedAt),
    status: resolveExternalReviewTokenOperatorStatus(row),
  };
}

export function pickPrimaryActiveToken(rows: ExternalReviewTokenOperatorRow[]): ExternalReviewTokenOperatorRow | null {
  const actives = rows.filter((r) => r.status === "active");
  if (actives.length === 0) return null;
  return actives.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function detailsRecord(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return details as Record<string, unknown>;
}

/** Scan newest-first audit rows for the first external client review decision. */
export function findLastExternalClientReviewFromAuditRows(
  rows: { action: string; postId: string | null; details: unknown; createdAt: Date | string }[]
): LastExternalClientReviewSummary | null {
  for (const r of rows) {
    if (r.action !== "publish_approval_approved" && r.action !== "publish_approval_rejected") continue;
    const d = detailsRecord(r.details);
    if (d.reviewSurface !== "external_social_review") continue;
    return {
      at: iso(r.createdAt) ?? new Date().toISOString(),
      decision: r.action === "publish_approval_rejected" ? "rejected" : "approved",
      postId: r.postId,
    };
  }
  return null;
}

export type PostClientLinkContext = {
  postId: string;
  pendingApproval: boolean;
  clientLinkCanAct: boolean;
  clientLinkGatedReason: string | null;
};

export function buildPostClientLinkContext(args: {
  post: typeof campaignPosts.$inferSelect;
  campaign: CampaignRow;
  primaryActiveAllowedRoles: ReturnType<typeof parseExternalReviewAllowedRolesJson>;
  hasActiveClientReviewToken: boolean;
}): PostClientLinkContext {
  const { post, campaign, primaryActiveAllowedRoles, hasActiveClientReviewToken } = args;
  const workerUtm = post.utmParams;
  const utm =
    workerUtm && typeof workerUtm === "object" && !Array.isArray(workerUtm)
      ? Object.fromEntries(
          Object.entries(workerUtm as Record<string, unknown>)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        )
      : {};

  const parsed = parsePublishApprovalFromUtm(utm);
  const pendingApproval = parsed.status === "pending_approval";

  if (!hasActiveClientReviewToken) {
    return {
      postId: post.id,
      pendingApproval,
      clientLinkCanAct: false,
      clientLinkGatedReason: pendingApproval ? "No active client review link for this campaign." : null,
    };
  }

  const canAct = campaignPostVisibleOnExternalSocialReviewQueue({
    post,
    campaign,
    allowedRoles: primaryActiveAllowedRoles,
  });

  if (canAct) {
    return {
      postId: post.id,
      pendingApproval,
      clientLinkCanAct: true,
      clientLinkGatedReason: null,
    };
  }

  let reason = "This post is not awaiting client action on the current link.";
  if (!pendingApproval) {
    reason = "Post is not in pending approval.";
  } else {
    reason =
      "Pending approval, but the active link’s allowed roles do not match the current chain step (or the post is not eligible).";
  }

  return {
    postId: post.id,
    pendingApproval,
    clientLinkCanAct: false,
    clientLinkGatedReason: reason,
  };
}
