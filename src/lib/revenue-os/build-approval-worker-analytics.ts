/**
 * Deterministic approval vs operational worker analytics (no I/O, no LLM).
 */

import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import type {
  RevenueOsApprovalWorkerAnalytics,
  RevenueOsApprovalWorkerInsight,
  RevenueOsApprovalWorkerSummary,
  RevenueOsLastWorkerRunSnapshot,
} from "@/lib/revenue-os/approval-worker-analytics-types";
import { canScheduledPostPublishUnderApprovalMode } from "@/lib/revenue-os/publish-approval-gate";
import {
  connectedSocialPlatformsSet,
  normalizeCampaignPostPlatformForPublish,
} from "@/lib/social/platform-identity";
import { isScheduledPostDue, type CampaignPostLike } from "@/lib/social/scheduled-publish-executor";
import type { SocialPlatform } from "@/lib/social/config";

export type CampaignPostForApprovalWorkerAnalytics = {
  id: string;
  platform: string;
  status: string;
  scheduledAt?: Date | string | null;
  scheduledPublishMeta?: unknown;
  utmParams?: Record<string, string> | null;
  postedAt?: Date | string | null;
  errorMessage?: string | null;
};

export type BuildApprovalWorkerAnalyticsArgs = {
  posts: CampaignPostForApprovalWorkerAnalytics[];
  now: Date;
  /** True when server env and/or UI session requires approval before worker claims posts. */
  workerRequiresApproval: boolean;
  /** Same shape as publish workflow — if omitted, OAuth gaps are not counted as operational blockers. */
  socialAccounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
  /** Last cron/worker result if the client stored it (e.g. session). */
  lastWorkerRun?: RevenueOsLastWorkerRunSnapshot | null;
  /** Hours for `recentlyPublished` (POSTED with postedAt in window). Default 48. */
  recentlyPublishedWithinHours?: number;
};

function toPostLike(p: CampaignPostForApprovalWorkerAnalytics): CampaignPostLike {
  return {
    id: p.id,
    status: p.status,
    scheduledAt: p.scheduledAt ?? null,
    scheduledPublishMeta: p.scheduledPublishMeta,
  };
}

function utmRecord(p: CampaignPostForApprovalWorkerAnalytics): Record<string, string> | null {
  const u = p.utmParams;
  if (!u || typeof u !== "object") return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(u)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function postedWithinHours(postedAt: Date | string | null | undefined, now: Date, hours: number): boolean {
  if (postedAt == null) return false;
  const t = postedAt instanceof Date ? postedAt.getTime() : new Date(postedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t <= hours * 3600 * 1000;
}

function buildInsightWithDue(
  summary: RevenueOsApprovalWorkerSummary,
  args: {
    workerRequiresApproval: boolean;
    hasAnyDueNow: boolean;
    dueEligibleNow: number;
  }
): RevenueOsApprovalWorkerInsight {
  const { workerRequiresApproval, hasAnyDueNow, dueEligibleNow } = args;
  const {
    dueNowButBlockedByApproval,
    failedOperationally,
    retryScheduled,
    publishingNow,
    awaitingApproval,
    skippedByApproval,
  } = summary;

  const opSignal = failedOperationally + Math.min(retryScheduled, 5);
  const approvalDueBlocked = dueNowButBlockedByApproval;

  let primary: RevenueOsApprovalWorkerBottleneck = "mixed";
  let summaryText: string;
  let recommendation: string;

  if (failedOperationally > 0 && !hasAnyDueNow && publishingNow === 0) {
    primary = "operational_failure";
    summaryText = `${failedOperationally} post(s) failed operationally; nothing else is due for the worker right now.`;
    recommendation =
      "Open **Launch Campaigns**, inspect error messages, reconnect accounts if needed, and retry or reschedule.";
  } else if (publishingNow > 0 && !hasAnyDueNow && approvalDueBlocked === 0 && dueEligibleNow === 0) {
    primary = "ready_to_run";
    summaryText = "A post is publishing now; the worker is active.";
    recommendation = "Wait for completion, then check Launch Campaigns for outcomes.";
  } else if (
    !hasAnyDueNow &&
    publishingNow === 0 &&
    failedOperationally === 0 &&
    retryScheduled === 0 &&
    approvalDueBlocked === 0
  ) {
    primary = "no_due_posts";
    summaryText = "Nothing is due for the timed publish worker right now.";
    recommendation =
      "When posts are scheduled and their time passes, the worker will pick them up (if approval allows). Open **Publish workflow review** to confirm schedules and approvals.";
  } else if (
    workerRequiresApproval &&
    approvalDueBlocked > 0 &&
    dueEligibleNow === 0 &&
    failedOperationally === 0
  ) {
    primary = "approval_waiting";
    summaryText = `${approvalDueBlocked} post(s) are due now but blocked by approval — the worker is waiting on a human decision.`;
    recommendation =
      "Open **Step 4 → Publish workflow review**, approve safe rows, or clear rejections. Scheduling alone does not satisfy the approval gate.";
  } else if (dueEligibleNow > 0 && approvalDueBlocked === 0) {
    primary = "ready_to_run";
    summaryText = `${dueEligibleNow} approved post(s) are due now and eligible for the worker on the next cron run.`;
    recommendation =
      "Ensure `POST /api/internal/scheduled-publish/run` runs on schedule. Check **Launch Campaigns** if anything stays stuck.";
  } else if (failedOperationally > 0 && failedOperationally >= approvalDueBlocked && failedOperationally >= dueEligibleNow) {
    primary = "operational_failure";
    summaryText = `${failedOperationally} post(s) failed operationally; retries may be queued separately.`;
    recommendation =
      "Review **Launch Campaigns** for error messages, reconnect OAuth if needed, and use **Retry** where available.";
  } else if (retryScheduled > 0 && opSignal > approvalDueBlocked + dueEligibleNow) {
    primary = "operational_failure";
    summaryText = `${retryScheduled} post(s) are in retry_scheduled — the system is backing off before the next attempt.`;
    recommendation = "Fix underlying errors (tokens, platform limits), then let the worker retry or trigger manual publish.";
  } else if (workerRequiresApproval && awaitingApproval > 0 && dueEligibleNow === 0 && !hasAnyDueNow) {
    primary = "approval_waiting";
    summaryText = `${awaitingApproval} scheduled post(s) still need approval before the worker can publish them when due.`;
    recommendation = "Use **Publish workflow review** to approve or reject rows — I can’t approve from chat.";
  } else if (skippedByApproval > 0 && workerRequiresApproval) {
    primary = "mixed";
    summaryText = `The last worker run skipped ${skippedByApproval} post(s) awaiting approval; other factors may also apply.`;
    recommendation =
      "Compare **Due now blocked by approval** with failures in Launch Campaigns; resolve approval first, then operational issues.";
  } else {
    primary = "mixed";
    summaryText =
      "The queue has a mix of approval, schedule, and operational signals — see the counts below.";
    recommendation =
      "Start with **Publish workflow review** for approval and conflicts, then **Launch Campaigns** for failures and retries.";
  }

  return { primaryBottleneck: primary, summaryText, recommendation };
}

/**
 * Pure analytics: human approval bottlenecks vs operational (failures / retries / OAuth gaps).
 */
export function buildApprovalWorkerAnalytics(args: BuildApprovalWorkerAnalyticsArgs): RevenueOsApprovalWorkerAnalytics {
  const now = args.now;
  const workerRequiresApproval = Boolean(args.workerRequiresApproval);
  const hours = args.recentlyPublishedWithinHours ?? 48;
  const connected = args.socialAccounts?.length
    ? connectedSocialPlatformsSet(args.socialAccounts)
    : null;

  let totalScheduled = 0;
  let retryScheduled = 0;
  let publishingNow = 0;
  let failedOperationally = 0;
  let recentlyPublished = 0;
  let awaitingApproval = 0;
  let rejected = 0;
  let approvedAndEligible = 0;
  let dueNowButBlockedByApproval = 0;
  let dueEligibleNow = 0;
  let hasAnyDueNow = false;
  let scheduledRetryWithApproverUserId = 0;

  for (const p of args.posts) {
    const st = String(p.status || "").toUpperCase();
    const utm = utmRecord(p);

    if (st === "POSTED") {
      if (postedWithinHours(p.postedAt ?? null, now, hours)) recentlyPublished += 1;
      continue;
    }
    if (st === "PUBLISHING") {
      publishingNow += 1;
      continue;
    }
    if (st === "FAILED") {
      failedOperationally += 1;
      continue;
    }
    if (st === "SCHEDULED") {
      totalScheduled += 1;
    } else if (st === "RETRY_SCHEDULED") {
      retryScheduled += 1;
    } else {
      continue;
    }

    const parsedGov = parsePublishApprovalFromUtm(utm);
    if (parsedGov.decidedByUserId != null) scheduledRetryWithApproverUserId += 1;

    const like = toPostLike(p);
    const due = isScheduledPostDue(like, now);
    if (due) hasAnyDueNow = true;

    const gate = canScheduledPostPublishUnderApprovalMode({
      requireApproval: workerRequiresApproval,
      utmParams: utm,
    });

    const eff = resolveEffectiveApprovalStatus(workerRequiresApproval, utm);
    if (eff === "pending_approval") awaitingApproval += 1;
    if (eff === "rejected") rejected += 1;

    const canonical = normalizeCampaignPostPlatformForPublish(p.platform);
    const oauthOk = connected == null || (canonical ? connected.has(canonical) : false);
    const oauthBlock = connected != null && !oauthOk;

    const eligibleApproval = gate.ok;
    const eligibleWorker = eligibleApproval && !oauthBlock;

    if (eligibleWorker) {
      approvedAndEligible += 1;
      if (due) dueEligibleNow += 1;
    }

    if (due && workerRequiresApproval && !gate.ok) {
      dueNowButBlockedByApproval += 1;
    }
  }

  const skippedByApproval = Math.max(0, Math.floor(args.lastWorkerRun?.skippedAwaitingApproval ?? 0));

  const summary: RevenueOsApprovalWorkerSummary = {
    totalScheduled,
    awaitingApproval,
    approvedAndEligible,
    rejected,
    skippedByApproval,
    dueNowButBlockedByApproval,
    publishingNow,
    recentlyPublished,
    failedOperationally,
    retryScheduled,
    scheduledRetryWithApproverUserId,
    approverIdentitiesPresent: scheduledRetryWithApproverUserId > 0,
  };

  const insight = buildInsightWithDue(summary, {
    workerRequiresApproval,
    hasAnyDueNow,
    dueEligibleNow,
  });

  return { summary, insight };
}
