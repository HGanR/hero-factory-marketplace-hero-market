/**
 * Reviewer workload / bottleneck metrics for publish approval (Part 24).
 */

import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import {
  userCanActOnApprovalChainStep,
  userCanFinalizePublishApproval,
  normalizeReviewerRole,
  type CampaignReviewerRole,
} from "@/lib/revenue-os/campaign-reviewer-role";
import {
  isMultiStepPublishApprovalChain,
  requiredReviewerRoleForChainStep,
  type PublishApprovalChain,
  type PublishApprovalChainRequiredRole,
} from "@/lib/revenue-os/publish-approval-chain";
import type { PublishApprovalAnalyticsPostInput } from "@/lib/revenue-os/publish-approval-analytics";
import { buildPublishApprovalStepSlaRowView, resolveLogicalAwaitingStepIndex } from "@/lib/revenue-os/publish-approval-step-sla";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import { extractPublishApprovalAuditActorFromDetails } from "@/lib/revenue-os/publish-approval-audit";

const BY_ROLE_KEYS = ["editor", "approver", "owner"] as const;
export type PublishApprovalReviewerByRoleKey = (typeof BY_ROLE_KEYS)[number];

export type PublishApprovalReviewerByRoleStats = {
  totalPending: number;
  totalOverdue: number;
  /** Mean age among pending posts in this bucket with known step start; null if none. */
  averagePendingStepAgeMs: number | null;
};

export type PublishApprovalReviewerAnalyticsRow = {
  userId: number;
  reviewerRole: CampaignReviewerRole;
  pendingApprovalCount: number;
  overdueApprovalCount: number;
  averagePendingStepAgeMs: number | null;
  oldestPendingStepAgeMs: number | null;
  assignedCampaignCount: number;
  recentCompletedCount?: number;
};

export type PublishApprovalReviewerAnalyticsResult = {
  reviewers: PublishApprovalReviewerAnalyticsRow[];
  byRole: Record<PublishApprovalReviewerByRoleKey, PublishApprovalReviewerByRoleStats>;
};

function utmParamsToRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  return Object.fromEntries(
    Object.entries(utmParams as Record<string, unknown>).map(([k, v]) => [k, String(v)])
  );
}

function mapAnalyticsRoleToByRoleBucket(key: string): PublishApprovalReviewerByRoleKey {
  if (key === "editor" || key === "approver" || key === "owner") return key;
  return "owner";
}

/**
 * Users who may act on this pending post (same rules as chain step enforcement + legacy finalize).
 */
export function eligibleReviewerUserIdsForPendingPost(args: {
  requiredChainRole: PublishApprovalChainRequiredRole | null;
  ownerUserIdNum: number;
  assignmentRows: { userId: string; role: string }[];
}): Set<number> {
  const out = new Set<number>();
  const req = args.requiredChainRole;
  if (req == null) {
    if (Number.isFinite(args.ownerUserIdNum) && args.ownerUserIdNum > 0) {
      out.add(args.ownerUserIdNum);
    }
    for (const a of args.assignmentRows) {
      const r = normalizeReviewerRole(a.role);
      if (r === "reviewer") continue;
      if (!userCanFinalizePublishApproval(r, {})) continue;
      const uid = Number(String(a.userId).trim());
      if (Number.isFinite(uid) && uid > 0) out.add(uid);
    }
    return out;
  }
  if (req === "owner") {
    if (Number.isFinite(args.ownerUserIdNum) && args.ownerUserIdNum > 0) {
      out.add(args.ownerUserIdNum);
    }
    return out;
  }
  for (const a of args.assignmentRows) {
    const r = normalizeReviewerRole(a.role);
    const uid = Number(String(a.userId).trim());
    if (!Number.isFinite(uid) || uid <= 0) continue;
    if (userCanActOnApprovalChainStep(r, req, {})) {
      out.add(uid);
    }
  }
  return out;
}

export function reviewerDisplayRoleForUserId(args: {
  userId: number;
  ownerUserIdNum: number;
  assignmentRows: { userId: string; role: string }[];
}): CampaignReviewerRole {
  if (args.userId === args.ownerUserIdNum) return "owner";
  for (const a of args.assignmentRows) {
    const uid = Number(String(a.userId).trim());
    if (uid === args.userId) return normalizeReviewerRole(a.role);
  }
  return "owner";
}

function emptyByRole(): Record<PublishApprovalReviewerByRoleKey, PublishApprovalReviewerByRoleStats> {
  return {
    editor: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
    approver: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
    owner: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
  };
}

function meanRounded(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Count `publish_approval_approved` audit rows by actor user id (bounded list).
 */
export function countRecentPublishApprovalsByActorUserId(
  rows: { details: unknown }[],
  maxRows: number
): Map<number, number> {
  const cap = Math.max(0, Math.min(maxRows, rows.length));
  const counts = new Map<number, number>();
  for (let i = 0; i < cap; i += 1) {
    const actor = extractPublishApprovalAuditActorFromDetails(rows[i]!.details);
    const uid = actor.actorUserId;
    if (uid == null || !Number.isFinite(uid) || uid <= 0) continue;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  return counts;
}

/**
 * Per-reviewer workload for one campaign (owner + assignees only). Bottleneck sort: overdue desc, then oldest age desc.
 */
export function computePublishApprovalReviewerAnalytics(args: {
  posts: PublishApprovalAnalyticsPostInput[];
  publishApprovalChain: PublishApprovalChain | null;
  workerRequiresApproval: boolean;
  ownerUserId: string;
  assignmentRows: { userId: string; role: string }[];
  now?: Date;
  /** Recent approved events (newest first); used for optional throughput. */
  recentApprovalAuditRows?: { details: unknown }[];
  recentApprovalAuditMax?: number;
}): PublishApprovalReviewerAnalyticsResult {
  const nowMs = (args.now ?? new Date()).getTime();
  const chain = args.publishApprovalChain ?? null;
  const ownerNum = Number(String(args.ownerUserId).trim());

  const throughput =
    args.recentApprovalAuditRows && args.recentApprovalAuditRows.length > 0
      ? countRecentPublishApprovalsByActorUserId(
          args.recentApprovalAuditRows,
          args.recentApprovalAuditMax ?? 50
        )
      : null;

  type Acc = {
    pending: number;
    overdue: number;
    ages: number[];
  };
  const byUser = new Map<number, Acc>();

  const byRole = emptyByRole();
  const agesByRole: Record<PublishApprovalReviewerByRoleKey, number[]> = {
    editor: [],
    approver: [],
    owner: [],
  };

  for (const post of args.posts) {
    const utmRec = utmParamsToRecord(post.utmParams);
    const parsed = parsePublishApprovalFromUtm(utmRec);
    const effective = resolveEffectiveApprovalStatus(args.workerRequiresApproval, utmRec);
    if (effective !== "pending_approval") continue;

    const logicalStep = resolveLogicalAwaitingStepIndex({
      publishApprovalChain: chain,
      parsed,
    });

    const requiredRole: PublishApprovalChainRequiredRole | null =
      chain && isMultiStepPublishApprovalChain(chain)
        ? requiredReviewerRoleForChainStep(chain, logicalStep)
        : null;

    const slaView = buildPublishApprovalStepSlaRowView({
      effectiveApprovalStatus: effective,
      publishApprovalChain: chain,
      parsed,
      nowMs,
    });

    const age = slaView.approvalStepAgeMs;
    const overdue = slaView.approvalStepOverdue;

    const analyticsRoleKey = requiredRole ?? "unknown";
    const bucket = mapAnalyticsRoleToByRoleBucket(analyticsRoleKey);
    byRole[bucket].totalPending += 1;
    if (overdue) byRole[bucket].totalOverdue += 1;
    if (age != null) {
      agesByRole[bucket].push(age);
    }

    const eligible = eligibleReviewerUserIdsForPendingPost({
      requiredChainRole: requiredRole,
      ownerUserIdNum: ownerNum,
      assignmentRows: args.assignmentRows,
    });

    for (const uid of eligible) {
      let acc = byUser.get(uid);
      if (!acc) {
        acc = { pending: 0, overdue: 0, ages: [] };
        byUser.set(uid, acc);
      }
      acc.pending += 1;
      if (overdue) acc.overdue += 1;
      if (age != null) acc.ages.push(age);
    }
  }

  for (const k of BY_ROLE_KEYS) {
    byRole[k].averagePendingStepAgeMs = meanRounded(agesByRole[k]);
  }

  const reviewerUserIds = new Set<number>();
  if (Number.isFinite(ownerNum) && ownerNum > 0) reviewerUserIds.add(ownerNum);
  for (const a of args.assignmentRows) {
    const uid = Number(String(a.userId).trim());
    if (Number.isFinite(uid) && uid > 0) reviewerUserIds.add(uid);
  }

  const reviewers: PublishApprovalReviewerAnalyticsRow[] = [];
  for (const userId of reviewerUserIds) {
    const acc = byUser.get(userId) ?? { pending: 0, overdue: 0, ages: [] };
    const reviewerRole = reviewerDisplayRoleForUserId({
      userId,
      ownerUserIdNum: ownerNum,
      assignmentRows: args.assignmentRows,
    });
    const row: PublishApprovalReviewerAnalyticsRow = {
      userId,
      reviewerRole,
      pendingApprovalCount: acc.pending,
      overdueApprovalCount: acc.overdue,
      averagePendingStepAgeMs: meanRounded(acc.ages),
      oldestPendingStepAgeMs: acc.ages.length > 0 ? Math.max(...acc.ages) : null,
      assignedCampaignCount: 1,
    };
    if (throughput) {
      const c = throughput.get(userId);
      if (c != null && c > 0) row.recentCompletedCount = c;
    }
    reviewers.push(row);
  }

  reviewers.sort((a, b) => {
    if (b.overdueApprovalCount !== a.overdueApprovalCount) {
      return b.overdueApprovalCount - a.overdueApprovalCount;
    }
    const ao = a.oldestPendingStepAgeMs ?? -1;
    const bo = b.oldestPendingStepAgeMs ?? -1;
    return bo - ao;
  });

  return { reviewers, byRole };
}
