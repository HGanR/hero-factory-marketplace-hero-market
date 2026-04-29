/**
 * Normalized rows for publishing planner / calendar UI (LinkedIn-governed campaign_posts).
 */

import type { campaignPosts } from "@/lib/db/schema";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import {
  readScheduledPublishRequireApprovalEnv,
  canScheduledPostPublishUnderApprovalMode,
} from "@/lib/revenue-os/publish-approval-gate";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import {
  buildPublishReadinessMessage,
  getSocialPostEditCapabilities,
  isApprovalOverdueUiHint,
} from "@/lib/social/social-post-governance-edit";
import { rowStatusToPublishLabel } from "@/lib/social/social-governed-post-public";
import {
  buildApprovalChainSummaryLabel,
  buildApprovalCurrentActorLabel,
  buildApprovalCurrentStepDisplay,
  buildApprovalLastActionSummary,
  buildApprovalTimelinePreview,
  deriveOverdueSeverity,
  deriveSocialPostBlockedDiagnostics,
  formatPublishAttemptSummary,
  formatPublishLastErrorSummary,
  type PublishBlockedReasonCode,
  type SocialPublishOverdueSeverity,
} from "@/lib/social/social-publish-observability";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { defaultSocialAccountLabelForPlatform } from "@/lib/social/social-governed-platforms";
import { isFromSocialStudioUtm } from "@/lib/social/social-post-from-social-studio-utm";

export type PublishingPlannerItem = {
  id: string;
  campaignId: string;
  provider: string;
  contentPreview: string;
  /** Full caption for edit forms */
  content: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  /** Row status from DB */
  status: string;
  approvalStatus: RevenueOsPublishApprovalStatus;
  publishStatusLabel: ReturnType<typeof rowStatusToPublishLabel>;
  approvalBlocked: boolean;
  rejectionReason: string | null;
  socialAccountLabel: string | null;
  socialAccountId: string | null;
  assetId: string | null;
  assetCreativeType: string | null;
  linkUrl: string | null;
  currentApprovalStepIndex: number | null;
  totalApprovalSteps: number | null;
  currentApprovalRequiredRole: PublishApprovalChainRequiredRole | null;
  publishReadiness: string;
  approvalOverdueHint: boolean;
  updatedAt: string | null;
  lastError: string | null;
  externalPostId: string | null;
  editCapabilities: ReturnType<typeof getSocialPostEditCapabilities>;
  /** ISO day key UTC yyyy-mm-dd for grouping */
  plannerDayKey: string;

  /** Part 32 — observability (additive; derived from row + UTM, no extra DB reads in list builder). */
  approvalChainSummary: string;
  /** 1-based step when in a multi-step chain and pending; otherwise null. */
  approvalCurrentStep: number | null;
  approvalCurrentStepLabel: string | null;
  approvalCurrentActorLabel: string | null;
  approvalLastActionAt: string | null;
  approvalLastActionLabel: string | null;
  approvalDecisionSummary: string;
  approvalTimelinePreview: string[];
  publishAttemptSummary: string | null;
  publishLastAttemptAt: string | null;
  publishLastErrorSummary: string | null;
  blockedReason: string;
  blockedReasonCode: PublishBlockedReasonCode;
  overdueSeverity: SocialPublishOverdueSeverity;
  /** Short operator notes (e.g. gate reason, errors); capped in builder. */
  diagnostics: string[];
  /** Plain-English next step when blocked or not ready (null if none). */
  operatorNextActionHint: string | null;

  /** Part 38 — compact metrics hint for published rows (null when not applicable). */
  analyticsSummaryLine: string | null;

  /** Part 40 — campaign has an unrevoked, unexpired client review token (planner GET only). */
  hasActiveClientReviewLink?: boolean;

  /** Social Studio → `campaign_posts` lineage (UTM: `from_social_studio` / `social_studio_source` / `social_studio_run_id`) */
  fromSocialStudio: boolean;
};

function utmRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

/** UTC date key yyyy-mm-dd */
export function plannerDayKeyUtc(isoOrDate: string | Date | null | undefined): string {
  if (isoOrDate == null) return "unscheduled";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "unscheduled";
  return d.toISOString().slice(0, 10);
}

export function buildPublishingPlannerItems(args: {
  rows: (typeof campaignPosts.$inferSelect)[];
  socialAccountDisplayById: Record<string, string>;
  /** `campaign_assets.id` → `creative_type` (from planner route join). */
  creativeTypeByAssetId?: Record<string, string | null>;
  /** `campaign_post_id` → one-line metrics summary for POSTED rows. */
  analyticsSummaryByPostId?: Record<string, string | null>;
  now?: Date;
}): PublishingPlannerItem[] {
  const now = args.now ?? new Date();
  const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();

  return args.rows.map((row) => {
    const utm = utmRecord(row.utmParams);
    const fromSocialStudio = isFromSocialStudioUtm(utm);
    const parsed = parsePublishApprovalFromUtm(utm);
    const approvalStatus = resolveEffectiveApprovalStatus(workerRequiresApproval, utm);
    const caption = row.caption ?? "";
    const contentPreview = caption.length > 160 ? `${caption.slice(0, 157)}…` : caption;
    const scheduledFor = toIso(row.scheduledAt);
    const publishedAt = toIso(row.postedAt);

    const st = String(row.status || "").toUpperCase();
    const gate =
      st === "SCHEDULED" || st === "RETRY_SCHEDULED"
        ? canScheduledPostPublishUnderApprovalMode({ requireApproval: workerRequiresApproval, utmParams: utm })
        : { ok: true as const };
    const approvalBlocked = !gate.ok;

    const labelFromMap = row.socialAccountId ? args.socialAccountDisplayById[row.socialAccountId] : undefined;
    const label =
      labelFromMap?.trim() ||
      (row.socialAccountId ? defaultSocialAccountLabelForPlatform(row.platform) : null);

    const plannerAnchor = scheduledFor ?? publishedAt ?? toIso(row.updatedAt) ?? toIso(row.createdAt);
    const plannerDayKey = plannerDayKeyUtc(plannerAnchor);

    const caps = getSocialPostEditCapabilities({ post: row, workerRequiresApproval });

    const linkedAssetCreativeType =
      row.assetId && args.creativeTypeByAssetId
        ? args.creativeTypeByAssetId[row.assetId] ?? null
        : null;

    const blockedDiag = deriveSocialPostBlockedDiagnostics({
      post: row,
      workerRequiresApproval,
      now,
      linkedAssetCreativeType,
    });
    const metaParsed = parseScheduledPublishMeta(row.scheduledPublishMeta);
    const lastAct = buildApprovalLastActionSummary({ parsed, effectiveStatus: approvalStatus });
    const stepDisplay = buildApprovalCurrentStepDisplay({
      totalSteps: parsed.totalApprovalSteps,
      currentStepIndex: parsed.currentApprovalStepIndex,
    });
    const chainSummary = buildApprovalChainSummaryLabel({
      totalSteps: parsed.totalApprovalSteps,
      currentStepIndex: parsed.currentApprovalStepIndex,
      requiredRole: parsed.currentApprovalRequiredRole,
      effectiveStatus: approvalStatus,
    });
    const actorLabel = buildApprovalCurrentActorLabel({
      effectiveStatus: approvalStatus,
      requiredRole: parsed.currentApprovalRequiredRole,
      approvedByLabel: parsed.approvedBy,
    });
    const preview = buildApprovalTimelinePreview({ parsed, effectiveStatus: approvalStatus });
    const overdueSev = deriveOverdueSeverity({
      approvalOverdueHint: isApprovalOverdueUiHint({
        approvalStatus,
        approvalStepStartedAt: parsed.approvalStepStartedAt,
        now,
      }),
      blockedReasonCode: blockedDiag.blockedReasonCode,
    });
    const diagLines = [...blockedDiag.diagnostics, ...(gate.ok ? [] : [gate.reason])].filter(Boolean);
    const diagnostics = diagLines.slice(0, 5);
    const approvalCurrentStep =
      parsed.totalApprovalSteps != null &&
      parsed.totalApprovalSteps > 1 &&
      parsed.currentApprovalStepIndex != null &&
      approvalStatus === "pending_approval"
        ? parsed.currentApprovalStepIndex + 1
        : parsed.totalApprovalSteps === 1 && approvalStatus === "pending_approval"
          ? 1
          : null;

    return {
      id: row.id,
      campaignId: row.campaignId,
      provider: row.platform,
      contentPreview,
      content: caption,
      scheduledFor,
      publishedAt,
      status: row.status,
      approvalStatus,
      publishStatusLabel: rowStatusToPublishLabel(row),
      approvalBlocked,
      rejectionReason: parsed.approvalReason,
      socialAccountLabel: label,
      socialAccountId: row.socialAccountId ?? null,
      assetId: row.assetId ?? null,
      assetCreativeType: linkedAssetCreativeType,
      linkUrl: row.linkUrl ?? null,
      currentApprovalStepIndex: parsed.currentApprovalStepIndex,
      totalApprovalSteps: parsed.totalApprovalSteps,
      currentApprovalRequiredRole: parsed.currentApprovalRequiredRole,
      publishReadiness: buildPublishReadinessMessage({
        post: row,
        workerRequiresApproval,
        now,
        linkedAssetCreativeType,
      }),
      approvalOverdueHint: isApprovalOverdueUiHint({
        approvalStatus,
        approvalStepStartedAt: parsed.approvalStepStartedAt,
        now,
      }),
      updatedAt: toIso(row.updatedAt),
      lastError: row.errorMessage ?? null,
      externalPostId: row.platformPostId ?? null,
      editCapabilities: caps,
      plannerDayKey,

      approvalChainSummary: chainSummary,
      approvalCurrentStep,
      approvalCurrentStepLabel: stepDisplay,
      approvalCurrentActorLabel: actorLabel,
      approvalLastActionAt: lastAct.at,
      approvalLastActionLabel: lastAct.label,
      approvalDecisionSummary: chainSummary,
      approvalTimelinePreview: preview,
      publishAttemptSummary: formatPublishAttemptSummary(metaParsed),
      publishLastAttemptAt: metaParsed.lastPublishAttemptAt ?? null,
      publishLastErrorSummary: formatPublishLastErrorSummary(row),
      blockedReason: blockedDiag.blockedReason,
      blockedReasonCode: blockedDiag.blockedReasonCode,
      overdueSeverity: overdueSev,
      diagnostics,
      operatorNextActionHint: blockedDiag.nextActionHint,

      analyticsSummaryLine: args.analyticsSummaryByPostId?.[row.id] ?? null,

      fromSocialStudio,
    };
  });
}

export type PublishingPlannerDayGroup = {
  dayKey: string;
  items: PublishingPlannerItem[];
};

/** Sort items by scheduled/published time then updatedAt */
export function sortPublishingPlannerItems(items: PublishingPlannerItem[]): PublishingPlannerItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.scheduledFor ?? a.publishedAt ?? a.updatedAt ?? "") || 0;
    const tb = Date.parse(b.scheduledFor ?? b.publishedAt ?? b.updatedAt ?? "") || 0;
    if (ta !== tb) return ta - tb;
    return (a.contentPreview || "").localeCompare(b.contentPreview || "");
  });
}

export function groupPublishingPlannerItemsByDay(items: PublishingPlannerItem[]): PublishingPlannerDayGroup[] {
  const sorted = sortPublishingPlannerItems(items);
  const byDay = new Map<string, PublishingPlannerItem[]>();
  for (const it of sorted) {
    const k = it.plannerDayKey;
    const list = byDay.get(k) ?? [];
    list.push(it);
    byDay.set(k, list);
  }
  const keys = [...byDay.keys()].sort((a, b) => {
    if (a === "unscheduled") return 1;
    if (b === "unscheduled") return -1;
    return a.localeCompare(b);
  });
  return keys.map((dayKey) => ({ dayKey, items: byDay.get(dayKey) ?? [] }));
}

/** Short operator-facing status line */
export function formatPublishingPlannerStatus(item: PublishingPlannerItem): string {
  if (item.approvalOverdueHint) return "Overdue approval";
  if (item.publishStatusLabel === "published") return "Published";
  if (item.publishStatusLabel === "failed") return "Failed";
  if (item.publishStatusLabel === "publishing") return "Publishing";
  if (item.approvalStatus === "rejected") return "Rejected";
  if (item.approvalStatus === "pending_approval") return "Pending approval";
  if (item.approvalStatus === "approved" && item.publishStatusLabel === "scheduled") return "Scheduled";
  if (item.publishStatusLabel === "scheduled") return "Scheduled";
  if (item.approvalStatus === "approved") return "Approved";
  return "Draft";
}
