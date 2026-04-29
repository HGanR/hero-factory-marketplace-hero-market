/**
 * Maps operational blocker codes → resolution mode, operator CTAs, and deep links.
 * No side effects — safe on server or client.
 */

import type { BentleyOperationalIssueCode } from "@/lib/revenue-os/bentley-operational-blockers";
import { isBentleyOperationalIssueCode } from "@/lib/revenue-os/bentley-operational-blockers";
import { BENTLEY_SCOPE_DEFAULT_CLIENT, getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import type { BentleyOperationalBlockerRow } from "@/lib/revenue-os/bentley-autonomy-readiness";

export type BentleyBlockerResolutionMode = "automatic" | "assisted" | "manual_only";

/** High-level actions the dashboard can surface as buttons (deduped). */
export type BentleyBlockerActionId =
  | "connect_social_accounts"
  | "select_social_account_on_posts"
  | "complete_publish_approvals"
  | "retry_launch_sync"
  | "refresh_operational_readiness"
  | "review_publish_queue"
  | "continue_ai_revenue_os";

export type BentleyBlockerResolutionContext = {
  campaignId?: string | null;
  clientId?: string | null;
};

export type BentleyBlockerActionPlan = {
  code: BentleyOperationalIssueCode;
  resolutionMode: BentleyBlockerResolutionMode;
  /** What automation is allowed — never implies auto-publish without binding. */
  allowsAutomaticRetry: boolean;
  title: string;
  nextStep: string;
  primaryActionId: BentleyBlockerActionId;
  /** Dashboard / ROS paths with client scope when applicable. */
  href: string;
  /** Secondary hint for manual-only cases */
  manualNote?: string;
};

export const BENTLEY_OPERATIONAL_MAX_RETRIES = 3;

const ACTION_LABEL: Record<BentleyBlockerActionId, string> = {
  connect_social_accounts: "Connect account",
  select_social_account_on_posts: "Select account on posts",
  complete_publish_approvals: "Approve posts",
  retry_launch_sync: "Retry launch sync",
  refresh_operational_readiness: "Refresh status",
  review_publish_queue: "Review publish queue",
  continue_ai_revenue_os: "Open AI Revenue OS",
};

export function bentleyBlockerActionLabel(id: BentleyBlockerActionId): string {
  return ACTION_LABEL[id] ?? id;
}

/** Build scoped dashboard URL (hash targets match `bentley-scroll` / dashboard sections). */
export function buildBentleyOperatorHref(
  path: "/revenue-os/dashboard" | "/ai-revenue-os",
  opts: { hash?: string; clientId?: string | null }
): string {
  const q = new URLSearchParams();
  const cid =
    opts.clientId?.trim() ??
    (typeof window !== "undefined" ? getBentleyStorageScope()?.clientId?.trim() : undefined);
  if (cid && cid !== BENTLEY_SCOPE_DEFAULT_CLIENT) q.set("clientId", cid);
  const qs = q.toString();
  const base = qs ? `${path}?${qs}` : path;
  const h = opts.hash?.replace(/^#/, "").trim();
  return h ? `${base}#${h}` : base;
}

function plan(
  code: BentleyOperationalIssueCode,
  mode: BentleyBlockerResolutionMode,
  auto: boolean,
  title: string,
  next: string,
  action: BentleyBlockerActionId,
  href: string,
  manualNote?: string
): BentleyBlockerActionPlan {
  return {
    code,
    resolutionMode: mode,
    allowsAutomaticRetry: auto,
    title,
    nextStep: next,
    primaryActionId: action,
    href,
    manualNote,
  };
}

export function operationalCodesFromRows(rows: BentleyOperationalBlockerRow[]): BentleyOperationalIssueCode[] {
  const out: BentleyOperationalIssueCode[] = [];
  for (const r of rows) {
    if (isBentleyOperationalIssueCode(r.code)) out.push(r.code);
  }
  return out;
}

/**
 * Single-code resolution plan (guidance + primary CTA).
 * Automatic retries are **never** used to bypass approval or OAuth — only idempotent server calls (sync) may be suggested.
 */
export function resolveBentleyOperationalBlocker(
  code: BentleyOperationalIssueCode,
  ctx: BentleyBlockerResolutionContext = {}
): BentleyBlockerActionPlan {
  const clientId = ctx.clientId ?? null;
  const dash = (hash: string) => buildBentleyOperatorHref("/revenue-os/dashboard", { hash, clientId });
  const ros = (hash?: string) => buildBentleyOperatorHref("/ai-revenue-os", { hash, clientId });

  switch (code) {
    case "launch_blocked_missing_social_account":
      return plan(
        code,
        "assisted",
        false,
        "Connect OAuth for the posting platform",
        "Open Launch & campaigns, connect the missing network, then retry launch sync.",
        "connect_social_accounts",
        dash("campaign-launch")
      );
    case "launch_blocked_provider_unresolved":
      return plan(
        code,
        "assisted",
        false,
        "Pin which connected account to use",
        "Edit each scheduled post and select a specific social account when multiple exist for the same platform.",
        "select_social_account_on_posts",
        dash("campaign-launch")
      );
    case "launch_ready_but_publish_not_possible":
      return plan(
        code,
        "assisted",
        true,
        "Resolve binding or approval, then retry",
        "Fix OAuth / account selection / approvals below, then use **Retry launch sync** (idempotent).",
        "retry_launch_sync",
        dash("campaign-launch"),
        "Does not auto-publish."
      );
    case "scheduled_but_worker_ineligible":
      return plan(
        code,
        "assisted",
        false,
        "Fix account resolution for scheduled posts",
        "Connect the platform or pin a specific account on each post, then retry launch sync.",
        "connect_social_accounts",
        dash("campaign-launch")
      );
    case "scheduled_but_missing_required_metadata":
      return plan(
        code,
        "manual_only",
        false,
        "Repair schedule metadata",
        "A post is SCHEDULED without a valid time — open the campaign in Revenue OS and fix schedule fields (support may be needed).",
        "continue_ai_revenue_os",
        ros()
      );
    case "approval_pending_blocks_publish":
      return plan(
        code,
        "assisted",
        false,
        "Complete publish approvals",
        "Approve or reject in the approval workflow — the worker will not publish gated posts until approved.",
        "complete_publish_approvals",
        dash("deployment-center")
      );
    case "publish_failed_detected":
      return plan(
        code,
        "manual_only",
        false,
        "Inspect failed posts",
        "Review error text, fix content/account issues, then retry publish from the post or queue.",
        "review_publish_queue",
        dash("deployment-center")
      );
    case "analytics_waiting_initial_window":
      return plan(
        code,
        "assisted",
        true,
        "Still within feedback grace window",
        "Wait for metrics ingestion, or refresh status to re-check. Retries are capped.",
        "refresh_operational_readiness",
        dash("deployment-center")
      );
    case "analytics_blocked_no_feedback_after_expected_window":
      return plan(
        code,
        "assisted",
        true,
        "Feedback missing after grace period",
        "Refresh status, verify publishes succeeded, then check deployment feedback sync. Escalate if rows stay zero.",
        "refresh_operational_readiness",
        dash("deployment-center")
      );
    case "analytics_not_applicable_no_published_posts":
      return plan(
        code,
        "assisted",
        false,
        "Publish first",
        "Analytics feedback follows successful publishes — complete launch and publishing first.",
        "continue_ai_revenue_os",
        dash("campaign-launch")
      );
  }
}

export type MergedOperatorAction = {
  actionId: BentleyBlockerActionId;
  label: string;
  href: string;
  codes: BentleyOperationalIssueCode[];
};

const MERGE_PRIORITY: BentleyBlockerActionId[] = [
  "connect_social_accounts",
  "select_social_account_on_posts",
  "complete_publish_approvals",
  "retry_launch_sync",
  "review_publish_queue",
  "refresh_operational_readiness",
  "continue_ai_revenue_os",
];

/**
 * Collapse multiple blocker codes into a small set of operator buttons (priority order).
 */
export function mergeBentleyBlockerActions(
  codes: BentleyOperationalIssueCode[],
  ctx: BentleyBlockerResolutionContext = {}
): MergedOperatorAction[] {
  const uniq = [...new Set(codes)];
  const plans = uniq.map((c) => resolveBentleyOperationalBlocker(c, ctx));
  const byAction = new Map<BentleyBlockerActionId, MergedOperatorAction>();

  for (const p of plans) {
    const existing = byAction.get(p.primaryActionId);
    if (existing) {
      existing.codes.push(p.code);
    } else {
      byAction.set(p.primaryActionId, {
        actionId: p.primaryActionId,
        label: bentleyBlockerActionLabel(p.primaryActionId),
        href: p.href,
        codes: [p.code],
      });
    }
  }

  return MERGE_PRIORITY.map((id) => byAction.get(id)).filter(Boolean) as MergedOperatorAction[];
}
