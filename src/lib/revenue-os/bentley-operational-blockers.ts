/**
 * Production operational blockers for Bentley launch → publish → analytics.
 * Pure functions — no I/O. Server merges DB rows into inputs.
 */

import { BENTLEY_UTM_APPROVAL_STATUS } from "@/lib/revenue-os/publish-approval-utm";

/** Hours after first published post before “no feedback” is treated as blocked (not merely waiting). */
export const BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS = 48;

/** Operator-facing one-liners for each code (dashboard / debug). */
export const BENTLEY_OPERATIONAL_ISSUE_COPY: Record<BentleyOperationalIssueCode, string> = {
  launch_blocked_missing_social_account:
    "No OAuth-connected social account for this post’s platform — connect the platform in Workspace integrations before publish can run.",
  launch_blocked_provider_unresolved:
    "More than one account exists for this platform but the post does not pin a specific connection — pick an account on the post or reduce duplicates.",
  launch_ready_but_publish_not_possible:
    "Launch sync is recorded in-session, but posts still cannot be published (binding, approval, or worker prerequisites).",
  scheduled_but_worker_ineligible:
    "Post is scheduled but the publish worker cannot resolve a usable account/token for this platform.",
  scheduled_but_missing_required_metadata:
    "Post is SCHEDULED without a valid schedule time — metadata is incomplete.",
  approval_pending_blocks_publish:
    "Publish approval is pending on this post while the worker requires approval — publish is blocked until approved.",
  publish_failed_detected:
    "At least one campaign post is in FAILED status — review error messages and fix or reschedule.",
  analytics_waiting_initial_window:
    "Within the post-publish feedback grace window — still waiting for deployment feedback rows.",
  analytics_blocked_no_feedback_after_expected_window:
    "Past the feedback grace window with no deployment feedback rows — check metrics sync or ingestion.",
  analytics_not_applicable_no_published_posts:
    "Nothing POSTED yet — analytics feedback is not expected until at least one successful publish.",
};

/** Single source of truth for operational issue codes (resolution UI, readiness, tests). */
export const BENTLEY_OPERATIONAL_ISSUE_CODES = [
  "launch_blocked_missing_social_account",
  "launch_blocked_provider_unresolved",
  "launch_ready_but_publish_not_possible",
  "scheduled_but_worker_ineligible",
  "scheduled_but_missing_required_metadata",
  "approval_pending_blocks_publish",
  "publish_failed_detected",
  "analytics_waiting_initial_window",
  "analytics_blocked_no_feedback_after_expected_window",
  "analytics_not_applicable_no_published_posts",
] as const;

export type BentleyOperationalIssueCode = (typeof BENTLEY_OPERATIONAL_ISSUE_CODES)[number];

export function isBentleyOperationalIssueCode(c: string): c is BentleyOperationalIssueCode {
  return (BENTLEY_OPERATIONAL_ISSUE_CODES as readonly string[]).includes(c);
}

export type BentleyOperationalPostInput = {
  platform: string;
  status: string;
  scheduledAt: string | Date | null;
  socialAccountId: string | null;
  utmParams: unknown;
  errorMessage: string | null;
};

export type EvaluateBentleyOperationalIssuesInput = {
  posts: BentleyOperationalPostInput[];
  /** Distinct platforms (canonical) that have ≥1 `social_accounts` row for this user+client. */
  socialPlatformsConnected: string[];
  /** Platforms where more than one connected account exists — explicit `socialAccountId` on post recommended. */
  ambiguousSocialPlatforms: string[];
  workerRequiresApproval: boolean;
  /** Server analytics facts */
  deploymentFeedbackRows: number;
  publishedPostCount: number;
  /** ISO string of earliest `postedAt` among POSTED posts, if any */
  earliestPostedAtIso: string | null;
  /** When true, lifecycle shows launch sync complete — used for synthetic “publish not possible” */
  launchSyncedInSession: boolean;
  nowMs?: number;
};

function utmRecord(u: unknown): Record<string, string> | null {
  if (!u || typeof u !== "object" || Array.isArray(u)) return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function normPlatform(p: string): string {
  return String(p ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Deterministic issue codes for operator + readiness surfaces.
 */
export function evaluateBentleyOperationalIssues(input: EvaluateBentleyOperationalIssuesInput): {
  codes: BentleyOperationalIssueCode[];
  analyticsDetail: {
    status: "ok" | "blocked" | "waiting" | "unknown";
    reasonCode: string;
    detail: string;
  };
} {
  const now = input.nowMs ?? Date.now();
  const connected = new Set(input.socialPlatformsConnected.map(normPlatform));
  const ambiguous = new Set(input.ambiguousSocialPlatforms.map(normPlatform));
  const issueCodes = new Set<BentleyOperationalIssueCode>();

  let hasPublishBlocker = false;

  for (const p of input.posts) {
    const st = String(p.status ?? "").toUpperCase();
    const plat = normPlatform(p.platform);
    if (st === "FAILED") {
      issueCodes.add("publish_failed_detected");
      hasPublishBlocker = true;
      continue;
    }

    if (st === "SCHEDULED" || st === "RETRY_SCHEDULED") {
      const at = p.scheduledAt ? new Date(p.scheduledAt).getTime() : NaN;
      if (st === "SCHEDULED" && !Number.isFinite(at)) {
        issueCodes.add("scheduled_but_missing_required_metadata");
        hasPublishBlocker = true;
      }
      if (!connected.has(plat)) {
        issueCodes.add("launch_blocked_missing_social_account");
        issueCodes.add("scheduled_but_worker_ineligible");
        hasPublishBlocker = true;
      } else if (ambiguous.has(plat) && !p.socialAccountId?.trim()) {
        issueCodes.add("launch_blocked_provider_unresolved");
        hasPublishBlocker = true;
      }

      const utm = utmRecord(p.utmParams);
      const appr = utm?.[BENTLEY_UTM_APPROVAL_STATUS] ?? "";
      if (input.workerRequiresApproval && /pending/i.test(appr)) {
        issueCodes.add("approval_pending_blocks_publish");
        hasPublishBlocker = true;
      }
    }
  }

  if (input.launchSyncedInSession && hasPublishBlocker) {
    issueCodes.add("launch_ready_but_publish_not_possible");
  }

  // Analytics semantics
  let analyticsStatus: "ok" | "blocked" | "waiting" | "unknown" = "unknown";
  let reasonCode = "analytics_unknown";
  let analyticsDetail = "Server did not supply publish/feedback timing — cannot classify analytics readiness.";

  const published = input.publishedPostCount;
  const df = input.deploymentFeedbackRows;

  if (published === 0) {
    analyticsStatus = input.posts.length > 0 ? "waiting" : "unknown";
    reasonCode = "analytics_not_applicable_no_published_posts";
    analyticsDetail =
      published === 0 && input.posts.length > 0
        ? "Posts exist but none are POSTED yet — deployment feedback usually appears after first successful publish."
        : "No published posts in scope — analytics feedback is not expected yet.";
    if (published === 0 && input.posts.length > 0) {
      issueCodes.add("analytics_not_applicable_no_published_posts");
    }
  } else if (df > 0) {
    analyticsStatus = "ok";
    reasonCode = "analytics_ok";
    analyticsDetail = `Deployment feedback rows present (**${df}**).`;
  } else if (input.earliestPostedAtIso) {
    const t0 = new Date(input.earliestPostedAtIso).getTime();
    const graceMs = BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS * 3600 * 1000;
    if (now - t0 < graceMs) {
      analyticsStatus = "waiting";
      reasonCode = "analytics_waiting_initial_window";
      analyticsDetail = `No feedback rows yet; within **${BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS}h** grace window after first publish — still waiting.`;
      issueCodes.add("analytics_waiting_initial_window");
    } else {
      analyticsStatus = "blocked";
      reasonCode = "analytics_blocked_no_feedback_after_expected_window";
      analyticsDetail = `No deployment feedback rows **${BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS}h** after first publish — investigate sync or ingestion.`;
      issueCodes.add("analytics_blocked_no_feedback_after_expected_window");
    }
  } else {
    analyticsStatus = "waiting";
    reasonCode = "analytics_waiting_initial_window";
    analyticsDetail = "Published posts reported but earliest publish time unknown — treating as waiting.";
  }

  return {
    codes: [...issueCodes],
    analyticsDetail: { status: analyticsStatus, reasonCode, detail: analyticsDetail },
  };
}
