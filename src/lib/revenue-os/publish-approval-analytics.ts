/**
 * Lightweight publish-approval bottleneck metrics (Part 20).
 */

import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import {
  isMultiStepPublishApprovalChain,
  requiredReviewerRoleForChainStep,
  type PublishApprovalChain,
  type PublishApprovalChainRequiredRole,
} from "@/lib/revenue-os/publish-approval-chain";
import {
  buildPublishApprovalStepSlaRowView,
  resolveLogicalAwaitingStepIndex,
} from "@/lib/revenue-os/publish-approval-step-sla";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";

export type PublishApprovalAnalyticsPostInput = {
  id: string;
  utmParams: Record<string, unknown> | null | undefined;
};

export type PublishApprovalAnalyticsSummary = {
  pendingApprovalCount: number;
  overdueApprovalCount: number;
  /** Mean age among pending posts with a known `approvalStepStartedAt`; null if none. */
  averagePendingStepAgeMs: number | null;
  /** Max age among pending with known start; null if none. */
  oldestPendingStepAgeMs: number | null;
  byRole: Record<string, number>;
  byStepIndex: Record<string, number>;
};

export type PublishApprovalStalledPostRow = {
  postId: string;
  approvalStatus: RevenueOsPublishApprovalStatus;
  currentApprovalStepIndex: number;
  totalApprovalSteps: number | null;
  currentApprovalRequiredRole: PublishApprovalChainRequiredRole | null;
  approvalStepAgeMs: number | null;
  approvalStepAgeShortLabel: string | null;
  approvalStepOverdue: boolean;
};

export type PublishApprovalAnalyticsResult = {
  summary: PublishApprovalAnalyticsSummary;
  stalledPosts: PublishApprovalStalledPostRow[];
};

function utmParamsToRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  return Object.fromEntries(
    Object.entries(utmParams as Record<string, unknown>).map(([k, v]) => [k, String(v)])
  );
}

const DEFAULT_STALLED_LIMIT = 8;

/**
 * Deterministic aggregates over campaign posts (no I/O).
 */
export function computePublishApprovalAnalytics(args: {
  posts: PublishApprovalAnalyticsPostInput[];
  publishApprovalChain: PublishApprovalChain | null;
  workerRequiresApproval: boolean;
  now?: Date;
  stalledPostsLimit?: number;
}): PublishApprovalAnalyticsResult {
  const nowMs = (args.now ?? new Date()).getTime();
  const chain = args.publishApprovalChain ?? null;
  const stalledLimit = Math.min(25, Math.max(1, args.stalledPostsLimit ?? DEFAULT_STALLED_LIMIT));

  const byRole: Record<string, number> = {};
  const byStepIndex: Record<string, number> = {};
  let pendingApprovalCount = 0;
  let overdueApprovalCount = 0;
  const ageSamples: number[] = [];
  const pendingRows: PublishApprovalStalledPostRow[] = [];

  for (const post of args.posts) {
    const utmRec = utmParamsToRecord(post.utmParams);
    const parsed = parsePublishApprovalFromUtm(utmRec);
    const effective = resolveEffectiveApprovalStatus(args.workerRequiresApproval, utmRec);
    if (effective !== "pending_approval") continue;

    pendingApprovalCount += 1;

    const logicalStep = resolveLogicalAwaitingStepIndex({
      publishApprovalChain: chain,
      parsed,
    });

    const requiredRole: PublishApprovalChainRequiredRole | null =
      chain && isMultiStepPublishApprovalChain(chain)
        ? requiredReviewerRoleForChainStep(chain, logicalStep)
        : null;

    const roleKey = requiredRole ?? "unknown";
    byRole[roleKey] = (byRole[roleKey] ?? 0) + 1;

    const stepKey = String(logicalStep);
    byStepIndex[stepKey] = (byStepIndex[stepKey] ?? 0) + 1;

    const slaView = buildPublishApprovalStepSlaRowView({
      effectiveApprovalStatus: effective,
      publishApprovalChain: chain,
      parsed,
      nowMs,
    });

    if (slaView.approvalStepOverdue) {
      overdueApprovalCount += 1;
    }

    const age = slaView.approvalStepAgeMs;
    if (age != null) {
      ageSamples.push(age);
    }

    pendingRows.push({
      postId: post.id,
      approvalStatus: effective,
      currentApprovalStepIndex: logicalStep,
      totalApprovalSteps:
        chain && isMultiStepPublishApprovalChain(chain) ? chain.steps.length : null,
      currentApprovalRequiredRole: requiredRole,
      approvalStepAgeMs: age,
      approvalStepAgeShortLabel: slaView.approvalStepAgeShortLabel,
      approvalStepOverdue: slaView.approvalStepOverdue,
    });
  }

  const averagePendingStepAgeMs =
    ageSamples.length > 0
      ? Math.round(ageSamples.reduce((a, b) => a + b, 0) / ageSamples.length)
      : null;
  const oldestPendingStepAgeMs =
    ageSamples.length > 0 ? Math.max(...ageSamples) : null;

  pendingRows.sort((a, b) => {
    const ax = a.approvalStepAgeMs ?? -1;
    const bx = b.approvalStepAgeMs ?? -1;
    return bx - ax;
  });

  return {
    summary: {
      pendingApprovalCount,
      overdueApprovalCount,
      averagePendingStepAgeMs,
      oldestPendingStepAgeMs,
      byRole,
      byStepIndex,
    },
    stalledPosts: pendingRows.slice(0, stalledLimit),
  };
}
