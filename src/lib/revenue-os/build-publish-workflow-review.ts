/**
 * Deterministic publish-workflow review list (no I/O, no LLM).
 */

import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import {
  matchPostsToScheduleSlots,
  type CampaignPostForScheduleApply,
} from "@/lib/revenue-os/apply-sequence-schedule-to-drafts";
import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";
import { canScheduledPostPublishUnderApprovalMode } from "@/lib/revenue-os/publish-approval-gate";
import {
  clampAwaitingChainStepIndex,
  isMultiStepPublishApprovalChain,
  requiredReviewerRoleForChainStep,
  type PublishApprovalChain,
  type PublishApprovalChainRequiredRole,
} from "@/lib/revenue-os/publish-approval-chain";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { buildPublishApprovalStepSlaRowView } from "@/lib/revenue-os/publish-approval-step-sla";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import type {
  RevenueOsPublishWorkflowRow,
  RevenueOsPublishWorkflowRowStatus,
  RevenueOsPublishWorkflowSummary,
} from "@/lib/revenue-os/publish-workflow-review-types";
import type { RevenueOsSuggestedSchedulePlan } from "@/lib/revenue-os/content-sequence-schedule-types";
import {
  connectedSocialPlatformsSet,
  normalizeCampaignPostPlatformForPublish,
} from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";

export type CampaignPostForPublishReview = {
  id: string;
  platform: string;
  status: string;
  scheduledAt?: string | Date | null;
  caption?: string | null;
  utmParams?: Record<string, string> | null;
  postedAt?: string | Date | null;
  errorMessage?: string | null;
  /** From `campaign_posts.updated_at` — used for approval PATCH stale guards. */
  updatedAt?: string | Date | null;
};

export type BuildPublishWorkflowReviewArgs = {
  posts: CampaignPostForPublishReview[];
  schedulePlan?: RevenueOsSuggestedSchedulePlan | null;
  batchCalendarSequence?: RevenueOsBatchCalendarSequence | null;
  /** From GET /api/social/accounts — used for OAuth coverage conflicts. */
  socialAccounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
  /** Optional deployment readiness blockers (e.g. from computeDeploymentReadiness). */
  deploymentReadinessBlockers?: string[];
  /** When true (matches server worker gate), missing approval → pending; eligibility uses gate. */
  workerRequiresApproval?: boolean;
  /** Campaign-level chain when all posts belong to one campaign (publish workflow panel). */
  publishApprovalChain?: PublishApprovalChain | null;
  /** Override “now” for SLA age (tests). */
  publishApprovalSlaNow?: Date;
  /** Include `approvalStepSlaDebug` on each row (workflow debug UI). */
  publishApprovalSlaDebug?: boolean;
};

const ROLE_SORT: Record<RevenueOsContentBatchRole, number> = {
  attention: 1,
  authority: 2,
  engagement: 3,
  lead_capture: 4,
  distribution_support: 5,
};

function toIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

function mapDbStatus(s: string): RevenueOsPublishWorkflowRowStatus {
  const u = s.trim().toUpperCase();
  if (u === "DRAFT") return "draft";
  if (u === "SCHEDULED") return "scheduled";
  if (u === "PUBLISHING") return "publishing";
  if (u === "POSTED") return "published";
  if (u === "RETRY_SCHEDULED") return "retry_scheduled";
  if (u === "FAILED") return "failed";
  return "draft";
}

function parseRole(utm: Record<string, string> | null | undefined): RevenueOsContentBatchRole | undefined {
  const raw =
    utm?.bentley_content_role ??
    utm?.["bentley_content_role"] ??
    utm?.bentley_schedule_role ??
    utm?.["bentley_schedule_role"];
  if (!raw) return undefined;
  const r = String(raw).trim();
  if (
    r === "attention" ||
    r === "engagement" ||
    r === "authority" ||
    r === "lead_capture" ||
    r === "distribution_support"
  ) {
    return r;
  }
  return undefined;
}

function parseSeqDay(utm: Record<string, string> | null | undefined): number | null {
  const raw = utm?.bentley_sequence_day_index ?? utm?.["bentley_sequence_day_index"];
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSuggested(utm: Record<string, string> | null | undefined): string | null {
  const raw = utm?.bentley_suggested_schedule_at ?? utm?.["bentley_suggested_schedule_at"];
  if (!raw) return null;
  const s = String(raw).trim();
  return s || null;
}

function titleFromCaption(caption: string | null | undefined): string | undefined {
  if (!caption?.trim()) return undefined;
  const line = caption.split(/\n+/)[0]?.trim() ?? "";
  if (!line) return undefined;
  return line.slice(0, 120);
}

function bodyPreviewFromCaption(caption: string | null | undefined): string {
  if (!caption?.trim()) return "—";
  const t = caption.trim().replace(/\s+/g, " ");
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function roleSortKey(role: RevenueOsContentBatchRole | undefined): number {
  if (!role) return 99;
  return ROLE_SORT[role] ?? 99;
}

function sortTimeMs(row: RevenueOsPublishWorkflowRow): number | null {
  const a = row.actualScheduledAt ? new Date(row.actualScheduledAt).getTime() : NaN;
  if (Number.isFinite(a)) return a;
  const s = row.suggestedScheduledAt ? new Date(row.suggestedScheduledAt).getTime() : NaN;
  return Number.isFinite(s) ? s : null;
}

/**
 * Build ordered review rows + summary for the publish workflow panel / Bentley.
 */
export function buildPublishWorkflowReview(args: BuildPublishWorkflowReviewArgs): RevenueOsPublishWorkflowSummary {
  const workerReq = Boolean(args.workerRequiresApproval);
  const connected = args.socialAccounts?.length
    ? connectedSocialPlatformsSet(args.socialAccounts)
    : new Set<SocialPlatform>();

  const scheduleApplyPosts: CampaignPostForScheduleApply[] = args.posts.map((p) => ({
    id: p.id,
    platform: p.platform,
    scheduledAt: p.scheduledAt,
    utmParams: p.utmParams ?? null,
  }));

  const slotByPostId = new Map<string, { suggested: string; dayIndex: number }>();
  if (args.schedulePlan?.slots?.length && args.batchCalendarSequence?.slots?.length) {
    const pairs = matchPostsToScheduleSlots(
      scheduleApplyPosts,
      args.schedulePlan,
      args.batchCalendarSequence
    );
    for (const { postId, slotIndex } of pairs) {
      const slot = args.schedulePlan.slots[slotIndex];
      if (!slot?.suggestedScheduledAt) continue;
      const seqDay = args.batchCalendarSequence.slots[slotIndex]?.dayIndex ?? slot.dayIndex;
      slotByPostId.set(postId, { suggested: slot.suggestedScheduledAt, dayIndex: seqDay });
    }
  }

  const rows: RevenueOsPublishWorkflowRow[] = args.posts.map((p) => {
    const utm = p.utmParams ?? null;
    const utmRec = utm as Record<string, string> | null;
    const role = parseRole(utm);
    let sequenceDayIndex = parseSeqDay(utm);
    let suggested = parseSuggested(utm);
    const slotHit = slotByPostId.get(p.id);
    if (!suggested && slotHit) {
      suggested = slotHit.suggested;
      if (sequenceDayIndex == null) sequenceDayIndex = slotHit.dayIndex;
    }

    const st = mapDbStatus(p.status);
    const actual = toIso(p.scheduledAt);

    const row: RevenueOsPublishWorkflowRow = {
      postId: p.id,
      role,
      platform: p.platform,
      title: titleFromCaption(p.caption ?? null),
      bodyPreview: bodyPreviewFromCaption(p.caption ?? null),
      suggestedScheduledAt: suggested,
      actualScheduledAt: actual,
      sequenceDayIndex,
      status: st,
    };

    const canonical = normalizeCampaignPostPlatformForPublish(p.platform);
    const hasOAuth = canonical ? connected.has(canonical) : false;

    if (st === "failed") {
      row.hasConflict = true;
      row.conflictSeverity = "blocking";
      row.conflictReason = p.errorMessage?.trim()
        ? `Publish failed: ${p.errorMessage.trim().slice(0, 200)}`
        : "Publish failed — review in Launch Campaigns.";
    } else if ((st === "scheduled" || st === "retry_scheduled") && !hasOAuth) {
      row.hasConflict = true;
      row.conflictSeverity = "blocking";
      row.conflictReason = `No connected OAuth account for **${p.platform}** — scheduled post cannot run.`;
    } else if (st === "draft" && suggested && !actual) {
      row.hasConflict = true;
      row.conflictSeverity = "advisory";
      row.conflictReason = "Suggested time not yet confirmed on this draft.";
    } else if (st === "publishing") {
      row.hasConflict = true;
      row.conflictSeverity = "advisory";
      row.conflictReason = "Publishing in progress.";
    }

    const parsedAp = parsePublishApprovalFromUtm(utmRec);
    row.approvalStatus = resolveEffectiveApprovalStatus(workerReq, utmRec);
    row.approvedAt = parsedAp.approvedAt;
    row.approvalReason = parsedAp.approvalReason;
    row.approvalDecidedAt = parsedAp.decidedAt;
    row.approvalDecidedByLabel = parsedAp.approvedBy;
    row.approvalDecidedByUserId = parsedAp.decidedByUserId;
    row.approvalActorRole = parsedAp.actorRole;
    row.hasApprovalIdentity = parsedAp.decidedByUserId != null;
    row.approvalIdentitySessionOnly =
      parsedAp.decidedByUserId == null &&
      Boolean(parsedAp.approvedBy?.trim()) &&
      (row.approvalStatus === "approved" || row.approvalStatus === "rejected");

    let currentApprovalStepIndex: number | null = null;
    let totalApprovalSteps: number | null = null;
    let currentApprovalRequiredRole: PublishApprovalChainRequiredRole | null = null;
    const ch = args.publishApprovalChain ?? null;
    if (
      ch &&
      isMultiStepPublishApprovalChain(ch) &&
      row.approvalStatus === "pending_approval"
    ) {
      const idx = clampAwaitingChainStepIndex(ch, parsedAp.currentApprovalStepIndex);
      currentApprovalStepIndex = idx;
      totalApprovalSteps = ch.steps.length;
      currentApprovalRequiredRole = requiredReviewerRoleForChainStep(ch, idx);
    }
    row.currentApprovalStepIndex = currentApprovalStepIndex;
    row.totalApprovalSteps = totalApprovalSteps;
    row.currentApprovalRequiredRole = currentApprovalRequiredRole;

    const gate = canScheduledPostPublishUnderApprovalMode({
      requireApproval: workerReq,
      utmParams: utmRec,
    });
    row.eligibleForWorker = Boolean(
      (st === "scheduled" || st === "retry_scheduled") &&
        !(row.hasConflict && row.conflictSeverity === "blocking") &&
        gate.ok
    );
    row.postRowUpdatedAt = toIso(p.updatedAt);

    const slaNow = args.publishApprovalSlaNow ?? new Date();
    const slaView = buildPublishApprovalStepSlaRowView({
      effectiveApprovalStatus: row.approvalStatus ?? "not_required",
      publishApprovalChain: ch,
      parsed: parsedAp,
      nowMs: slaNow.getTime(),
      includeDebug: Boolean(args.publishApprovalSlaDebug),
    });
    row.approvalStepOverdue = slaView.approvalStepOverdue;
    row.approvalStepAgeMs = slaView.approvalStepAgeMs;
    row.approvalStepAgeShortLabel = slaView.approvalStepAgeShortLabel;
    if (slaView.approvalStepSlaDebug) {
      row.approvalStepSlaDebug = slaView.approvalStepSlaDebug;
    }

    return row;
  });

  const minuteKey = (platform: string, iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;
    return `${platform.trim().toLowerCase()}|${Math.floor(t / 60000)}`;
  };

  const bucket = new Map<string, string[]>();
  for (const r of rows) {
    if (r.status !== "scheduled" && r.status !== "retry_scheduled") continue;
    const k = minuteKey(r.platform, r.actualScheduledAt);
    if (!k) continue;
    const arr = bucket.get(k) ?? [];
    arr.push(r.postId);
    bucket.set(k, arr);
  }
  for (const [, ids] of bucket) {
    if (ids.length < 2) continue;
    for (const r of rows) {
      if (!ids.includes(r.postId)) continue;
      r.hasConflict = true;
      r.conflictSeverity = "blocking";
      r.conflictReason = "Duplicate **same platform + same minute** schedule — adjust one time.";
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const ta = sortTimeMs(a);
    const tb = sortTimeMs(b);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    const da = a.sequenceDayIndex ?? 999;
    const db = b.sequenceDayIndex ?? 999;
    if (da !== db) return da - db;
    return roleSortKey(a.role) - roleSortKey(b.role);
  });

  let draft = 0;
  let scheduled = 0;
  let failed = 0;
  let published = 0;
  for (const r of sorted) {
    if (r.status === "draft") draft += 1;
    else if (r.status === "published") published += 1;
    else if (r.status === "failed") failed += 1;
    else scheduled += 1;
  }

  const blockers: string[] = [];
  if (args.deploymentReadinessBlockers?.length) {
    blockers.push(...args.deploymentReadinessBlockers);
  }
  if (failed > 0) {
    blockers.push(`${failed} post(s) in **failed** state — resolve before treating the queue as clean.`);
  }
  const blockingRows = sorted.filter((r) => r.conflictSeverity === "blocking");
  if (blockingRows.length) {
    const dup = blockingRows.some((r) => r.conflictReason?.includes("Duplicate"));
    const oauth = blockingRows.some((r) => r.conflictReason?.includes("No connected OAuth"));
    if (dup) blockers.push("Resolve **duplicate schedule times** on the same platform.");
    if (oauth) blockers.push("Connect OAuth or reschedule posts for missing platforms.");
  }

  const readyToConfirm =
    blockers.length === 0 && !sorted.some((r) => r.conflictSeverity === "blocking");

  return {
    rows: sorted,
    counts: { draft, scheduled, failed, published },
    blockers: [...new Set(blockers)],
    readyToConfirm,
    sortBasis: "actual_scheduled_then_suggested_then_sequence_day_then_role_priority",
  };
}
