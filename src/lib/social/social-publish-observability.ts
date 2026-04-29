/**
 * Planner / post-detail observability for governed social publishing.
 * Derives from UTM governance, row status, scheduled_publish_meta, and campaign_audit_events — no second approval model.
 */

import type { campaignPosts } from "@/lib/db/schema";
import { isCreativeTypeAllowedForProviderMedia } from "@/lib/social/social-provider-publish-capabilities";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import { parsePublishApprovalFromUtm, type ParsedPublishApprovalUtm } from "@/lib/revenue-os/publish-approval-utm";
import { canScheduledPostPublishUnderApprovalMode } from "@/lib/revenue-os/publish-approval-gate";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { rowStatusToPublishLabel, type SocialPublishStatusLabel } from "@/lib/social/social-governed-post-public";
import { isApprovalOverdueUiHint } from "@/lib/social/social-post-governance-edit";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { extractPublishApprovalAuditActorFromDetails } from "@/lib/revenue-os/publish-approval-audit";
import type { SocialPostTimelineAuditRow } from "@/lib/social/social-post-audit-query";

export type CampaignAuditEventLite = SocialPostTimelineAuditRow;

export {
  SOCIAL_POST_TIMELINE_AUDIT_ACTIONS,
  isSocialPostTimelineAuditAction,
  clampSocialPostTimelineLimit,
  DEFAULT_SOCIAL_POST_TIMELINE_LIMIT,
  MAX_SOCIAL_POST_TIMELINE_LIMIT,
} from "@/lib/social/social-post-audit-query";

/** Human-readable labels for timeline rows (stable for docs/tests). */
export const SOCIAL_ACTIVITY_TIMELINE_ORDER = "newest_first" as const;

export type SocialActivityTimelineEventKind =
  | "created"
  | "submitted_for_approval"
  | "approval_step_advanced"
  | "approved"
  | "rejected"
  | "edit_reset_approval"
  | "resubmitted"
  | "publish_attempted"
  | "published"
  | "publish_failed"
  | "retry_scheduled"
  | "schedule_changed"
  | "account_changed"
  | "content_changed"
  | "link_changed"
  | "asset_changed"
  | "analytics_refresh_failed"
  | "other";

export type SocialActivityTimelineEntry = {
  kind: SocialActivityTimelineEventKind;
  /** ISO timestamp */
  at: string;
  label: string;
  detail: string | null;
  sourceAuditId: string | null;
  rawAction: string | null;
};

export type PublishBlockedReasonCode =
  | "none"
  | "awaiting_approval"
  | "approval_overdue"
  | "rejected_needs_resubmit"
  | "missing_account"
  | "missing_schedule"
  | "missing_content"
  | "provider_connection_issue"
  | "publish_failed_retryable"
  | "publish_failed_terminal"
  | "published_read_only"
  /** Instagram Graph Content Publishing requires media; text-only is not API-supported yet. */
  | "instagram_requires_media"
  /** Linked campaign asset creative type cannot be published on this provider (e.g. TEXT on Instagram). */
  | "provider_media_incompatible";

export type SocialPublishOverdueSeverity = "none" | "hint" | "attention";

export type SocialPostBlockedDiagnostics = {
  blockedReasonCode: PublishBlockedReasonCode;
  /** Operator-facing primary message (plain English). */
  blockedReason: string;
  /** Short hint for the next likely action, if any. */
  nextActionHint: string | null;
  /** Extra bullet-style notes (cap applied by caller if needed). */
  diagnostics: string[];
  /** True when the post is live or publishing — use read-only messaging, not “blocked to publish”. */
  publishedOrPublishing: boolean;
};

export type SocialPostApprovalDetail = {
  status: RevenueOsPublishApprovalStatus;
  currentStepIndex: number | null;
  currentStepDisplay: string | null;
  currentApproverLabel: string | null;
  totalSteps: number | null;
  completedSteps: number | null;
  pendingSince: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  overdueHint: boolean;
  chainSummary: string;
  lastActionAt: string | null;
  lastActionSummary: string | null;
};

export type SocialPostPublishDetail = {
  rowStatus: string;
  publishStatusLabel: SocialPublishStatusLabel;
  lastAttemptedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureSummary: string | null;
  retryable: boolean;
  publishBlocked: boolean;
  blockedReason: string | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

export function formatChainRoleLabel(role: PublishApprovalChainRequiredRole | null | undefined): string {
  if (!role) return "reviewer";
  if (role === "editor") return "editor";
  if (role === "approver") return "approver";
  if (role === "owner") return "owner";
  return role;
}

export function formatChainRoleDisplay(role: PublishApprovalChainRequiredRole | null | undefined): string {
  const l = formatChainRoleLabel(role);
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/**
 * Compact chain summary for planner rows / badges (e.g. "Step 2 of 3 · Approver").
 */
export function buildApprovalChainSummaryLabel(args: {
  totalSteps: number | null;
  currentStepIndex: number | null;
  requiredRole: PublishApprovalChainRequiredRole | null;
  effectiveStatus: RevenueOsPublishApprovalStatus;
}): string {
  const { totalSteps, currentStepIndex, requiredRole, effectiveStatus } = args;
  if (effectiveStatus === "approved") {
    return totalSteps != null && totalSteps > 1 ? `Approved (all ${totalSteps} steps)` : "Approved";
  }
  if (effectiveStatus === "rejected") return "Rejected";
  if (effectiveStatus === "not_required") return "Approval not required";
  if (effectiveStatus !== "pending_approval") return "Draft";

  const roleDisp = requiredRole ? formatChainRoleDisplay(requiredRole) : "Reviewer";
  if (totalSteps != null && totalSteps > 1 && currentStepIndex != null) {
    return `Step ${currentStepIndex + 1} of ${totalSteps} · ${roleDisp}`;
  }
  return `Pending · ${roleDisp}`;
}

export function buildApprovalCurrentStepDisplay(args: {
  totalSteps: number | null;
  currentStepIndex: number | null;
}): string | null {
  const { totalSteps, currentStepIndex } = args;
  if (totalSteps == null || totalSteps <= 1) return totalSteps === 1 ? "Step 1 of 1" : null;
  if (currentStepIndex == null) return `Chain (${totalSteps} steps)`;
  return `Step ${currentStepIndex + 1} of ${totalSteps}`;
}

export function buildApprovalCurrentActorLabel(args: {
  effectiveStatus: RevenueOsPublishApprovalStatus;
  requiredRole: PublishApprovalChainRequiredRole | null;
  approvedByLabel: string | null;
}): string | null {
  if (args.effectiveStatus === "pending_approval") {
    return `Awaiting ${formatChainRoleDisplay(args.requiredRole)}`;
  }
  if (args.effectiveStatus === "approved" && args.approvedByLabel?.trim()) {
    return args.approvedByLabel.trim();
  }
  return null;
}

export function deriveCompletedApprovalSteps(args: {
  effectiveStatus: RevenueOsPublishApprovalStatus;
  totalSteps: number | null;
  currentStepIndex: number | null;
}): number | null {
  const { effectiveStatus, totalSteps, currentStepIndex } = args;
  if (totalSteps == null) return null;
  if (effectiveStatus === "approved") return totalSteps;
  if (effectiveStatus === "pending_approval" && currentStepIndex != null) return currentStepIndex;
  if (effectiveStatus === "rejected" && currentStepIndex != null) return currentStepIndex;
  return 0;
}

function utmRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function gateForRow(
  post: typeof campaignPosts.$inferSelect,
  utm: Record<string, string>,
  workerRequiresApproval: boolean
): { ok: true } | { ok: false; reason: string } {
  const st = String(post.status || "").toUpperCase();
  if (st === "SCHEDULED" || st === "RETRY_SCHEDULED") {
    return canScheduledPostPublishUnderApprovalMode({ requireApproval: workerRequiresApproval, utmParams: utm });
  }
  return { ok: true };
}

/**
 * Typed blocked / readiness diagnostics (approval vs publish vs data gaps).
 */
export function deriveSocialPostBlockedDiagnostics(args: {
  post: typeof campaignPosts.$inferSelect;
  workerRequiresApproval: boolean;
  now?: Date;
  /** When known (planner/detail join on `campaign_assets`), used for Instagram/Facebook media gates. */
  linkedAssetCreativeType?: string | null;
}): SocialPostBlockedDiagnostics {
  const now = args.now ?? new Date();
  const utm = utmRecord(args.post.utmParams);
  const parsed = parsePublishApprovalFromUtm(utm);
  const effective = resolveEffectiveApprovalStatus(args.workerRequiresApproval, utm);
  const st = String(args.post.status || "").toUpperCase();
  const gate = gateForRow(args.post, utm, args.workerRequiresApproval);
  const overdue = isApprovalOverdueUiHint({
    approvalStatus: effective,
    approvalStepStartedAt: parsed.approvalStepStartedAt,
    now,
  });
  const caption = (args.post.caption ?? "").trim();
  const meta = parseScheduledPublishMeta(args.post.scheduledPublishMeta);
  const lastErr = (args.post.errorMessage ?? meta.lastPublishError ?? "").trim();

  const diagnostics: string[] = [];
  const push = (s: string) => {
    if (s && !diagnostics.includes(s)) diagnostics.push(s);
  };

  if (st === "POSTED" || st === "PUBLISHING") {
    return {
      blockedReasonCode: "published_read_only",
      blockedReason: st === "POSTED" ? "Published — this post is read-only." : "Publishing in progress — edits are locked.",
      nextActionHint: null,
      diagnostics: [],
      publishedOrPublishing: true,
    };
  }

  if (st === "RETRY_SCHEDULED") {
    push("A worker will retry this publish automatically.");
    return {
      blockedReasonCode: "publish_failed_retryable",
      blockedReason: "Last publish failed — a retry is scheduled.",
      nextActionHint: "Wait for the retry or fix the underlying issue (e.g. reconnect the account).",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if (st === "FAILED") {
    return {
      blockedReasonCode: "publish_failed_terminal",
      blockedReason: lastErr ? `Publish failed: ${truncate(lastErr, 160)}` : "Publish failed.",
      nextActionHint: "Review the error, edit content or schedule, then reschedule.",
      diagnostics: lastErr ? [truncate(lastErr, 120)] : [],
      publishedOrPublishing: false,
    };
  }

  if (parsed.status === "rejected" || effective === "rejected") {
    return {
      blockedReasonCode: "rejected_needs_resubmit",
      blockedReason: "Rejected — revise and resubmit for approval.",
      nextActionHint: "Edit if needed, then use Resubmit for approval.",
      diagnostics: parsed.approvalReason ? [parsed.approvalReason] : [],
      publishedOrPublishing: false,
    };
  }

  const platformLower = String(args.post.platform || "").toLowerCase();
  if (platformLower === "instagram" && !args.post.assetId) {
    return {
      blockedReasonCode: "instagram_requires_media",
      blockedReason:
        "Instagram publishing needs an image or video on this post (campaign asset). The API does not support text-only publishes yet.",
      nextActionHint: "Link an IMAGE or VIDEO asset to this post (or create the post with media) before scheduling.",
      diagnostics: [],
      publishedOrPublishing: false,
    };
  }

  if (
    platformLower === "instagram" &&
    args.post.assetId &&
    args.linkedAssetCreativeType != null &&
    String(args.linkedAssetCreativeType).trim() !== "" &&
    !isCreativeTypeAllowedForProviderMedia("instagram", args.linkedAssetCreativeType)
  ) {
    return {
      blockedReasonCode: "provider_media_incompatible",
      blockedReason:
        "Instagram cannot publish this campaign asset type. Use an IMAGE or VIDEO asset with a public storage URL.",
      nextActionHint: "Change the linked asset in the post editor to an image or video file.",
      diagnostics: [],
      publishedOrPublishing: false,
    };
  }

  if (!caption) {
    return {
      blockedReasonCode: "missing_content",
      blockedReason: "Add post content before this can go live.",
      nextActionHint: "Enter copy in the content field.",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if ((st === "SCHEDULED" || st === "RETRY_SCHEDULED") && !args.post.socialAccountId) {
    return {
      blockedReasonCode: "missing_account",
      blockedReason: "Choose a connected social account for this post.",
      nextActionHint: "Select an account in the detail panel.",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if (st === "DRAFT" && !args.post.scheduledAt) {
    return {
      blockedReasonCode: "missing_schedule",
      blockedReason: "Draft — set a scheduled time (or publish path) before the worker can post.",
      nextActionHint: "Pick a schedule when you are ready.",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if (overdue && effective === "pending_approval") {
    return {
      blockedReasonCode: "approval_overdue",
      blockedReason: "Approval is taking longer than usual for this step.",
      nextActionHint: "Escalate to the pending reviewer or check campaign governance settings.",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if (!gate.ok && (effective === "pending_approval" || String(gate.reason).toLowerCase().includes("approval"))) {
    return {
      blockedReasonCode: "awaiting_approval",
      blockedReason: "Waiting for approval before the scheduled publish can run.",
      nextActionHint: "Wait for a reviewer to approve, or adjust governance if appropriate.",
      diagnostics,
      publishedOrPublishing: false,
    };
  }

  if (!gate.ok) {
    return {
      blockedReasonCode: "none",
      blockedReason: gate.reason,
      nextActionHint: null,
      diagnostics: [gate.reason],
      publishedOrPublishing: false,
    };
  }

  if (
    lastErr &&
    /oauth|token|expired|disconnect|revok|401|403|credential/i.test(lastErr) &&
    (st === "SCHEDULED" || st === "RETRY_SCHEDULED" || st === "DRAFT")
  ) {
    return {
      blockedReasonCode: "provider_connection_issue",
      blockedReason: "Connection or token issue may block publishing.",
      nextActionHint: "Reconnect the social account or pick a different one.",
      diagnostics: [truncate(lastErr, 120)],
      publishedOrPublishing: false,
    };
  }

  return {
    blockedReasonCode: "none",
    blockedReason: "",
    nextActionHint: null,
    diagnostics: [],
    publishedOrPublishing: false,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function formatPublishAttemptSummary(meta: ReturnType<typeof parseScheduledPublishMeta>): string | null {
  const n = meta.publishAttemptCount;
  if (n == null || n <= 0) return null;
  return n === 1 ? "1 publish attempt" : `${n} publish attempts`;
}

export function formatPublishLastErrorSummary(post: typeof campaignPosts.$inferSelect): string | null {
  const rowErr = (post.errorMessage ?? "").trim();
  if (rowErr) return truncate(rowErr, 200);
  const meta = parseScheduledPublishMeta(post.scheduledPublishMeta);
  const m = (meta.lastPublishError ?? "").trim();
  return m ? truncate(m, 200) : null;
}

export function deriveOverdueSeverity(args: {
  approvalOverdueHint: boolean;
  blockedReasonCode: PublishBlockedReasonCode;
}): SocialPublishOverdueSeverity {
  if (args.blockedReasonCode === "approval_overdue") return "attention";
  if (args.approvalOverdueHint) return "hint";
  return "none";
}

export function buildApprovalTimelinePreview(args: {
  parsed: ParsedPublishApprovalUtm;
  effectiveStatus: RevenueOsPublishApprovalStatus;
}): string[] {
  const lines: string[] = [];
  const { parsed, effectiveStatus } = args;
  if (parsed.approvalStepStartedAt && effectiveStatus === "pending_approval") {
    lines.push(`Pending since ${formatShortIso(parsed.approvalStepStartedAt)}`);
  }
  if (parsed.decidedAt && (effectiveStatus === "approved" || parsed.status === "approved")) {
    lines.push(`Last decision: approved (${formatShortIso(parsed.decidedAt)})`);
  }
  if (parsed.decidedAt && (effectiveStatus === "rejected" || parsed.status === "rejected")) {
    lines.push(`Rejected ${formatShortIso(parsed.decidedAt)}`);
  }
  return lines.slice(0, 3);
}

function formatShortIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function buildApprovalLastActionSummary(args: {
  parsed: ParsedPublishApprovalUtm;
  effectiveStatus: RevenueOsPublishApprovalStatus;
}): { at: string | null; label: string | null } {
  const { parsed, effectiveStatus } = args;
  if (effectiveStatus === "approved") {
    const at = parsed.decidedAt ?? parsed.approvedAt;
    const who = parsed.approvedBy?.trim();
    return {
      at,
      label: who ? `Approved by ${who}` : "Approved",
    };
  }
  if (effectiveStatus === "rejected") {
    return {
      at: parsed.decidedAt,
      label: parsed.approvalReason ? `Rejected: ${truncate(parsed.approvalReason, 80)}` : "Rejected",
    };
  }
  if (effectiveStatus === "pending_approval") {
    return {
      at: parsed.approvalStepStartedAt,
      label: "Awaiting approval",
    };
  }
  return { at: null, label: null };
}

export function buildSocialPostApprovalDetail(args: {
  post: typeof campaignPosts.$inferSelect;
  workerRequiresApproval: boolean;
  now?: Date;
}): SocialPostApprovalDetail {
  const utm = utmRecord(args.post.utmParams);
  const parsed = parsePublishApprovalFromUtm(utm);
  const status = resolveEffectiveApprovalStatus(args.workerRequiresApproval, utm);
  const now = args.now ?? new Date();
  const overdueHint = isApprovalOverdueUiHint({
    approvalStatus: status,
    approvalStepStartedAt: parsed.approvalStepStartedAt,
    now,
  });

  const pendingSince =
    status === "pending_approval" ? parsed.approvalStepStartedAt ?? parsed.approvedAt : null;
  const approvedAt = status === "approved" ? parsed.decidedAt ?? parsed.approvedAt : null;
  const rejectedAt = status === "rejected" ? parsed.decidedAt : null;

  const last = buildApprovalLastActionSummary({ parsed, effectiveStatus: status });

  return {
    status,
    currentStepIndex: parsed.currentApprovalStepIndex,
    currentStepDisplay: buildApprovalCurrentStepDisplay({
      totalSteps: parsed.totalApprovalSteps,
      currentStepIndex: parsed.currentApprovalStepIndex,
    }),
    currentApproverLabel: buildApprovalCurrentActorLabel({
      effectiveStatus: status,
      requiredRole: parsed.currentApprovalRequiredRole,
      approvedByLabel: parsed.approvedBy,
    }),
    totalSteps: parsed.totalApprovalSteps,
    completedSteps: deriveCompletedApprovalSteps({
      effectiveStatus: status,
      totalSteps: parsed.totalApprovalSteps,
      currentStepIndex: parsed.currentApprovalStepIndex,
    }),
    pendingSince,
    approvedAt,
    rejectedAt,
    rejectionReason: parsed.approvalReason,
    overdueHint,
    chainSummary: buildApprovalChainSummaryLabel({
      totalSteps: parsed.totalApprovalSteps,
      currentStepIndex: parsed.currentApprovalStepIndex,
      requiredRole: parsed.currentApprovalRequiredRole,
      effectiveStatus: status,
    }),
    lastActionAt: last.at,
    lastActionSummary: last.label,
  };
}

export function buildSocialPostPublishDetail(args: {
  post: typeof campaignPosts.$inferSelect;
  workerRequiresApproval: boolean;
  linkedAssetCreativeType?: string | null;
}): SocialPostPublishDetail {
  const utm = utmRecord(args.post.utmParams);
  const gate = gateForRow(args.post, utm, args.workerRequiresApproval);
  const meta = parseScheduledPublishMeta(args.post.scheduledPublishMeta);
  const st = String(args.post.status || "").toUpperCase();
  const label = rowStatusToPublishLabel(args.post);
  const lastAttempt = meta.lastPublishAttemptAt ?? null;
  const posted = args.post.postedAt ? iso(args.post.postedAt) : null;
  const failSummary = formatPublishLastErrorSummary(args.post);
  const retryable = st === "RETRY_SCHEDULED";
  const publishBlocked =
    st === "FAILED" ||
    retryable ||
    ((st === "SCHEDULED" || st === "RETRY_SCHEDULED") && !gate.ok);

  const diag = deriveSocialPostBlockedDiagnostics({
    post: args.post,
    workerRequiresApproval: args.workerRequiresApproval,
    linkedAssetCreativeType: args.linkedAssetCreativeType,
  });
  const blockedReason =
    diag.publishedOrPublishing || diag.blockedReasonCode === "none"
      ? null
      : diag.blockedReason || null;

  return {
    rowStatus: args.post.status,
    publishStatusLabel: label,
    lastAttemptedAt: lastAttempt,
    lastSuccessAt: posted,
    lastFailureSummary: failSummary,
    retryable,
    publishBlocked,
    blockedReason,
  };
}

function detailsRecord(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return details as Record<string, unknown>;
}

/**
 * Map a single campaign_audit_events row to a timeline entry. Unknown actions → `other` with raw action preserved.
 */
export function mapAuditRowToTimelineEntry(row: CampaignAuditEventLite): SocialActivityTimelineEntry {
  const at = iso(row.createdAt) ?? new Date().toISOString();
  const d = detailsRecord(row.details);
  const actor = extractPublishApprovalAuditActorFromDetails(row.details);
  const actorBit = actor.actorDisplayName ? ` · ${actor.actorDisplayName}` : "";
  const externalBit = d.reviewSurface === "external_social_review" ? " (client review link)" : "";

  const action = row.action;

  if (action === "publish_approval_pending") {
    const prev = d.prevDecision;
    const isResubmit = prev === "rejected";
    return {
      kind: isResubmit ? "resubmitted" : "submitted_for_approval",
      at,
      label: isResubmit ? "Resubmitted for approval" : "Submitted for approval",
      detail: actor.rationale ?? null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "publish_approval_cleared") {
    return {
      kind: "resubmitted",
      at,
      label: "Cleared rejection — back to review",
      detail: actor.rationale ?? null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "publish_approval_approved") {
    const chainCompleted = d.chainCompleted;
    const stepIdx = typeof d.approvalStepIndex === "number" ? d.approvalStepIndex : null;
    const intermediate = chainCompleted === false;
    return {
      kind: intermediate ? "approval_step_advanced" : "approved",
      at,
      label: intermediate
        ? `Approval step completed${stepIdx != null ? ` (step ${stepIdx + 1})` : ""}${actorBit}${externalBit}`
        : `Approved${actorBit}${externalBit}`,
      detail: (actor.rationale as string | undefined) ?? (typeof d.reason === "string" ? d.reason : null) ?? null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "publish_approval_rejected") {
    return {
      kind: "rejected",
      at,
      label: `Rejected${actorBit}${externalBit}`,
      detail: (typeof d.reason === "string" && d.reason) || actor.rationale || null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "scheduled_publish_attempted") {
    return {
      kind: "publish_attempted",
      at,
      label: "Publish attempt started",
      detail: typeof d.normalizedReason === "string" ? d.normalizedReason : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "scheduled_publish_succeeded") {
    return {
      kind: "published",
      at,
      label: "Published (scheduled worker)",
      detail: typeof d.platformPostId === "string" ? d.platformPostId : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "scheduled_publish_failed") {
    return {
      kind: "publish_failed",
      at,
      label: "Publish failed (worker)",
      detail: (typeof d.normalizedReason === "string" && d.normalizedReason) || (typeof d.code === "string" ? d.code : null),
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "scheduled_publish_retry_scheduled") {
    return {
      kind: "retry_scheduled",
      at,
      label: "Retry scheduled",
      detail: typeof d.nextPublishAttemptAt === "string" ? `Next try: ${d.nextPublishAttemptAt}` : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "publish") {
    return {
      kind: "published",
      at,
      label: "Published (manual)",
      detail: typeof d.platformPostId === "string" ? d.platformPostId : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "fail") {
    return {
      kind: "publish_failed",
      at,
      label: "Publish failed (manual)",
      detail: (typeof d.error === "string" && d.error) || (typeof d.code === "string" ? d.code : null),
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "content_changed") {
    const pl = d.prevCaptionLength;
    const nl = d.nextCaptionLength;
    const dim =
      typeof pl === "number" && typeof nl === "number" ? `Length ${pl} → ${nl}` : null;
    return {
      kind: "content_changed",
      at,
      label: "Content updated",
      detail: dim,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "schedule_changed") {
    const prev =
      d.previousScheduledAt != null && String(d.previousScheduledAt).length > 0
        ? String(d.previousScheduledAt)
        : null;
    const next =
      d.nextScheduledAt != null && String(d.nextScheduledAt).length > 0 ? String(d.nextScheduledAt) : null;
    const dim =
      prev || next
        ? `${prev ? truncateTimelineSnippet(prev, 24) : "—"} → ${next ? truncateTimelineSnippet(next, 24) : "unscheduled"}`
        : null;
    return {
      kind: "schedule_changed",
      at,
      label: "Schedule changed",
      detail: dim,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "link_changed") {
    const prev = typeof d.previousLinkUrl === "string" ? d.previousLinkUrl : null;
    const next = typeof d.nextLinkUrl === "string" ? d.nextLinkUrl : null;
    const dim =
      prev || next
        ? `${prev ? truncateTimelineSnippet(prev, 48) : "—"} → ${next ? truncateTimelineSnippet(next, 48) : "—"}`
        : null;
    return {
      kind: "link_changed",
      at,
      label: "Link updated",
      detail: dim,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "account_changed") {
    const prev = d.previousSocialAccountId != null ? String(d.previousSocialAccountId) : null;
    const next = d.nextSocialAccountId != null ? String(d.nextSocialAccountId) : null;
    return {
      kind: "account_changed",
      at,
      label: "Publishing account changed",
      detail: prev || next ? `${prev ?? "—"} → ${next ?? "—"}` : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "asset_changed") {
    const prev = d.previousAssetId != null ? String(d.previousAssetId) : null;
    const next = d.nextAssetId != null ? String(d.nextAssetId) : null;
    return {
      kind: "asset_changed",
      at,
      label: "Campaign media asset changed",
      detail: prev || next ? `${prev ? truncateTimelineSnippet(prev, 12) : "—"} → ${next ? truncateTimelineSnippet(next, 12) : "—"}` : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "approval_reset_after_edit") {
    const cf = d.changedFields;
    const fields = Array.isArray(cf) ? (cf as unknown[]).filter((x) => typeof x === "string").join(", ") : null;
    return {
      kind: "edit_reset_approval",
      at,
      label: "Approval reset after edit",
      detail: fields || null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "resubmitted_for_approval") {
    const cf = d.changedFields;
    const fields = Array.isArray(cf) && cf.length ? (cf as unknown[]).filter((x) => typeof x === "string").join(", ") : null;
    return {
      kind: "resubmitted",
      at,
      label: "Resubmitted for approval",
      detail: fields ? `Also adjusted: ${fields}` : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "governed_post_analytics_refresh_failed") {
    return {
      kind: "analytics_refresh_failed",
      at,
      label: "Metrics refresh failed",
      detail: typeof d.message === "string" ? d.message : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "external_review_link_minted") {
    const lab = typeof d.label === "string" && d.label.trim() ? ` — ${d.label.trim()}` : "";
    const exp =
      typeof d.expiresAt === "string" && d.expiresAt
        ? ` · expires ${new Date(d.expiresAt).toLocaleString()}`
        : "";
    const roles = Array.isArray(d.allowedRoles)
      ? (d.allowedRoles as unknown[]).filter((x) => typeof x === "string").join(", ")
      : null;
    return {
      kind: "other",
      at,
      label: `Client review link created${lab}${exp}`,
      detail: roles || null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "external_review_link_revoked") {
    const lab = typeof d.label === "string" && d.label.trim() ? ` — ${d.label.trim()}` : "";
    return {
      kind: "other",
      at,
      label: `Client review link revoked${lab}`,
      detail: typeof d.tokenId === "string" ? truncateTimelineSnippet(d.tokenId, 14) : null,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "external_review_link_email_sent") {
    const sub = typeof d.subject === "string" && d.subject.trim() ? truncateTimelineSnippet(d.subject.trim(), 40) : null;
    return {
      kind: "other",
      at,
      label: "Client review link emailed",
      detail: sub,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  if (action === "external_review_links_bulk_revoked") {
    const n = typeof d.revokedCount === "number" ? d.revokedCount : null;
    const mode = typeof d.mode === "string" && d.mode.trim() ? d.mode.trim() : "";
    const detail =
      n != null
        ? `${n} link${n === 1 ? "" : "s"}${mode ? ` · ${mode.replace(/_/g, " ")}` : ""}`
        : mode || null;
    return {
      kind: "other",
      at,
      label: "Client review links bulk revoked",
      detail,
      sourceAuditId: row.id,
      rawAction: action,
    };
  }

  return {
    kind: "other",
    at,
    label: humanizeAuditAction(action),
    detail: null,
    sourceAuditId: row.id,
    rawAction: action,
  };
}

function humanizeAuditAction(action: string): string {
  return action.replace(/_/g, " ");
}

function truncateTimelineSnippet(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Build a merged timeline: audit-backed rows plus synthetic anchors from the post row.
 * Order: **newest first** (see `SOCIAL_ACTIVITY_TIMELINE_ORDER`).
 */
export function buildSocialPostActivityTimeline(args: {
  post: typeof campaignPosts.$inferSelect;
  auditRows: CampaignAuditEventLite[];
}): SocialActivityTimelineEntry[] {
  const fromAudit = args.auditRows.map((r) => mapAuditRowToTimelineEntry(r));

  const synthetic: SocialActivityTimelineEntry[] = [];
  const createdAt = iso(args.post.createdAt);
  if (createdAt) {
    synthetic.push({
      kind: "created",
      at: createdAt,
      label: "Post created",
      detail: null,
      sourceAuditId: null,
      rawAction: null,
    });
  }

  const merged = [...fromAudit, ...synthetic];
  merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const seen = new Set<string>();
  const deduped: SocialActivityTimelineEntry[] = [];
  for (const e of merged) {
    const key = `${e.kind}|${e.at}|${e.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return deduped;
}
