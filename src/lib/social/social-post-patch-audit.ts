/**
 * Audit events for PATCH `/api/social/posts/[id]` (Revenue OS governed social).
 * Writes to `campaign_audit_events` — same store as worker + campaign governance.
 *
 * ## Emission rules (avoid duplicate timeline lines)
 *
 * 1. **Field dimensions** (`content_changed`, `schedule_changed`, `link_changed`, `account_changed`):
 *    Emit one row per dimension that **actually changed** in this request (not merely present in JSON).
 *
 * 2. **`resubmitted_for_approval`**: Emit when `resubmitForApproval` is true on a successful PATCH.
 *    Do **not** also emit `approval_reset_after_edit` in the same request — resubmit already explains the
 *    approval transition (rejected → pending / not_required).
 *
 * 3. **`approval_reset_after_edit`**: Emit only when `approvalReset && materialChanged && !resubmitForApproval`.
 *    Pairs with field rows when material edits forced a governance re-seed (worker approval gate on).
 *    Omit when the operator used resubmit (rule 2).
 *
 * 4. **`approval_status_changed`**: Not emitted from this path — reviewer decisions stay on
 *    `publish_approval_*` audit actions from campaign governance; avoids triple-counting the same transition.
 *
 * Insert order within a batch: field events first, then `approval_reset_after_edit` or `resubmitted_for_approval`
 * last so identical timestamps sort with the “summary” row newest when using sub-second offsets.
 */

import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

export const SOCIAL_POST_EDIT_AUDIT_ACTIONS = [
  "content_changed",
  "schedule_changed",
  "link_changed",
  "account_changed",
  "asset_changed",
  "approval_reset_after_edit",
  "resubmitted_for_approval",
] as const;

export type SocialPostEditAuditAction = (typeof SOCIAL_POST_EDIT_AUDIT_ACTIONS)[number];

export type SocialPostPatchFieldDelta = {
  content: { changed: boolean; prevLength: number; nextLength: number };
  schedule: { changed: boolean; prevIso: string | null; nextIso: string | null };
  link: { changed: boolean; prevTruncated: string | null; nextTruncated: string | null };
  account: { changed: boolean; prevAccountId: string | null; nextAccountId: string | null };
  asset: { changed: boolean; prevAssetId: string | null; nextAssetId: string | null };
};

export type PlanSocialPostPatchAuditArgs = {
  postId: string;
  campaignId: string;
  provider: string;
  resubmitForApproval: boolean;
  approvalReset: boolean;
  materialChanged: boolean;
  previousApprovalStatus: RevenueOsPublishApprovalStatus;
  nextApprovalStatus: RevenueOsPublishApprovalStatus;
  actor: { userId: number | null; label: string; role: string };
  fieldDelta: SocialPostPatchFieldDelta;
};

export type PlannedSocialPostPatchAuditRow = {
  action: SocialPostEditAuditAction;
  details: Record<string, unknown>;
};

const MAX_URL_SNIP = 96;

export function truncateForAudit(s: string | null | undefined, max = MAX_URL_SNIP): string | null {
  if (s == null || !String(s).trim()) return null;
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Returns audit rows to insert **oldest-first within the batch** (caller applies monotonic `createdAt` offsets).
 */
export function planSocialPostPatchAuditRows(args: PlanSocialPostPatchAuditArgs): PlannedSocialPostPatchAuditRow[] {
  const base: Record<string, unknown> = {
    postId: args.postId,
    campaignId: args.campaignId,
    provider: args.provider,
    source: "social_patch",
    actorUserId: args.actor.userId,
    actorLabel: args.actor.label,
    actorRole: args.actor.role,
    previousApprovalStatus: args.previousApprovalStatus,
    nextApprovalStatus: args.nextApprovalStatus,
    approvalReset: args.approvalReset,
    resubmitForApproval: args.resubmitForApproval,
  };

  const changedFieldNames: string[] = [];
  if (args.fieldDelta.content.changed) changedFieldNames.push("content");
  if (args.fieldDelta.schedule.changed) changedFieldNames.push("schedule");
  if (args.fieldDelta.link.changed) changedFieldNames.push("link");
  if (args.fieldDelta.account.changed) changedFieldNames.push("account");
  if (args.fieldDelta.asset.changed) changedFieldNames.push("asset");

  const rows: PlannedSocialPostPatchAuditRow[] = [];

  if (args.fieldDelta.content.changed) {
    rows.push({
      action: "content_changed",
      details: {
        ...base,
        changedFields: ["content"],
        prevCaptionLength: args.fieldDelta.content.prevLength,
        nextCaptionLength: args.fieldDelta.content.nextLength,
      },
    });
  }
  if (args.fieldDelta.schedule.changed) {
    rows.push({
      action: "schedule_changed",
      details: {
        ...base,
        changedFields: ["schedule"],
        previousScheduledAt: args.fieldDelta.schedule.prevIso,
        nextScheduledAt: args.fieldDelta.schedule.nextIso,
      },
    });
  }
  if (args.fieldDelta.link.changed) {
    rows.push({
      action: "link_changed",
      details: {
        ...base,
        changedFields: ["linkUrl"],
        previousLinkUrl: args.fieldDelta.link.prevTruncated,
        nextLinkUrl: args.fieldDelta.link.nextTruncated,
      },
    });
  }
  if (args.fieldDelta.account.changed) {
    rows.push({
      action: "account_changed",
      details: {
        ...base,
        changedFields: ["socialAccountId"],
        previousSocialAccountId: args.fieldDelta.account.prevAccountId,
        nextSocialAccountId: args.fieldDelta.account.nextAccountId,
      },
    });
  }
  if (args.fieldDelta.asset.changed) {
    rows.push({
      action: "asset_changed",
      details: {
        ...base,
        changedFields: ["assetId"],
        previousAssetId: args.fieldDelta.asset.prevAssetId,
        nextAssetId: args.fieldDelta.asset.nextAssetId,
      },
    });
  }

  const emitResetRow = args.approvalReset && args.materialChanged && !args.resubmitForApproval;
  if (emitResetRow) {
    rows.push({
      action: "approval_reset_after_edit",
      details: {
        ...base,
        changedFields: changedFieldNames,
        materialChanged: true,
      },
    });
  }

  if (args.resubmitForApproval) {
    rows.push({
      action: "resubmitted_for_approval",
      details: {
        ...base,
        changedFields: changedFieldNames.length ? changedFieldNames : [],
      },
    });
  }

  return rows;
}

/** Which audit `action` values PATCH may write (for tests and allow-lists). */
export function isSocialPostEditAuditAction(action: string): action is SocialPostEditAuditAction {
  return (SOCIAL_POST_EDIT_AUDIT_ACTIONS as readonly string[]).includes(action);
}
