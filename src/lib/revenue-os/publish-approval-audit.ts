/**
 * Publish-approval lifecycle audit actions (`campaign_audit_events.action`) and helpers.
 */

import { mapLegacyActorRoleToReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

/** Allow-list for SQL filters and timeline composition. */
export const PUBLISH_APPROVAL_AUDIT_ACTIONS = [
  "publish_approval_approved",
  "publish_approval_rejected",
  "publish_approval_cleared",
  "publish_approval_pending",
] as const;

export type PublishApprovalAuditAction = (typeof PUBLISH_APPROVAL_AUDIT_ACTIONS)[number];

export type PublishApprovalAuditActorExtract = {
  actorUserId?: number;
  actorDisplayName?: string | null;
  reviewerRole?: string;
  rationale?: string;
};

export type PublishApprovalAuditRecentApiEvent = {
  id: string;
  postId: string | null;
  action: string;
  platform: string | null;
  createdAt: string;
} & PublishApprovalAuditActorExtract;

function parseUserId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Pulls actor / rationale fields from audit `details` JSON for API + analytics.
 */
export function extractPublishApprovalAuditActorFromDetails(details: unknown): PublishApprovalAuditActorExtract {
  if (details == null || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }
  const d = details as Record<string, unknown>;
  const out: PublishApprovalAuditActorExtract = {};

  const uid = parseUserId(d.decidedByUserId);
  if (uid !== undefined) out.actorUserId = uid;

  if (typeof d.decidedByLabel === "string" && d.decidedByLabel.trim()) {
    out.actorDisplayName = d.decidedByLabel.trim();
  }

  if (typeof d.reviewerRole === "string" && d.reviewerRole.trim()) {
    out.reviewerRole = d.reviewerRole.trim();
  } else if (typeof d.actorRole === "string" && d.actorRole.trim()) {
    out.reviewerRole = mapLegacyActorRoleToReviewerRole(d.actorRole);
  }

  if (typeof d.reason === "string" && d.reason.trim()) {
    out.rationale = d.reason.trim();
  }

  return out;
}

/**
 * Maps approval status transition to a stable `campaign_audit_events.action` string.
 */
export function resolvePublishApprovalAuditAction(args: {
  nextStatus: RevenueOsPublishApprovalStatus;
  prevStatus: RevenueOsPublishApprovalStatus;
  chainIntermediateAdvance?: boolean;
}): PublishApprovalAuditAction {
  const { nextStatus, prevStatus, chainIntermediateAdvance } = args;

  if (chainIntermediateAdvance) {
    return "publish_approval_approved";
  }

  if (nextStatus === "approved" && prevStatus === "pending_approval") {
    return "publish_approval_approved";
  }
  if (nextStatus === "rejected" && prevStatus === "pending_approval") {
    return "publish_approval_rejected";
  }
  if (nextStatus === "pending_approval" && prevStatus === "rejected") {
    return "publish_approval_cleared";
  }
  if (nextStatus === "pending_approval" && prevStatus === "pending_approval") {
    return "publish_approval_pending";
  }

  return "publish_approval_pending";
}

export function toPublishApprovalAuditRecentApiEvent(row: {
  id: string;
  postId: string | null;
  action: string;
  platform: string | null;
  details: unknown;
  createdAt: Date | string;
}): PublishApprovalAuditRecentApiEvent {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const actor = extractPublishApprovalAuditActorFromDetails(row.details);
  return {
    id: row.id,
    postId: row.postId,
    action: row.action,
    platform: row.platform,
    createdAt,
    ...actor,
  };
}
