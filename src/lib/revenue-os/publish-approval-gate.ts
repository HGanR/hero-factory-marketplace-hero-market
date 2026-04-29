/**
 * Worker / UI gate: scheduled posts and approval metadata.
 */

export type CanScheduledPostPublishArgs = {
  /** When true (server env), enforce approval metadata for SCHEDULED / RETRY_SCHEDULED. */
  requireApproval: boolean;
  utmParams: Record<string, string> | null | undefined;
};

import { rawApprovalStatusKey } from "@/lib/revenue-os/publish-approval-utm";

/**
 * Returns whether a due scheduled post may be claimed by the publish worker.
 * When `requireApproval` is false, legacy behavior: any due scheduled post may run.
 */
export function canScheduledPostPublishUnderApprovalMode(
  args: CanScheduledPostPublishArgs
): { ok: true } | { ok: false; reason: string } {
  if (!args.requireApproval) {
    return { ok: true };
  }
  const raw = rawApprovalStatusKey(args.utmParams);
  if (!raw) {
    return { ok: false, reason: "Awaiting operator approval (set approval status on post)." };
  }
  const low = raw.toLowerCase().replace(/-/g, "_");
  if (low === "approved" || low === "not_required") {
    return { ok: true };
  }
  if (low === "rejected") {
    return { ok: false, reason: "Post is marked rejected — clear or re-approve before publishing." };
  }
  if (low === "pending_approval" || low === "pending") {
    return { ok: false, reason: "Awaiting operator approval before scheduled publish." };
  }
  return { ok: false, reason: "Unknown approval status — set to approved or not_required to publish." };
}

/** Read server-side flag (worker + API). */
export function readScheduledPublishRequireApprovalEnv(): boolean {
  const v = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;
  return v === "1" || v === "true" || v === "yes";
}
