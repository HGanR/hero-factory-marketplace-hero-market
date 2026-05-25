/**
 * Optimistic concurrency + idempotency helpers for campaign publish-approval PATCH writes.
 */

import type { ParsedPublishApprovalUtm } from "@/lib/revenue-os/publish-approval-utm";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

export type PublishApprovalWriteOutcome = "accepted_fresh" | "accepted_idempotent" | "rejected_stale";

export type ApprovalReviewSnapshotInput = {
  expectedApprovalStatus: RevenueOsPublishApprovalStatus;
  postUpdatedAt: string;
  expectedApprovalStepIndex?: number;
};

export type EvaluatePublishApprovalWriteResult =
  | { outcome: "accepted_fresh" }
  | { outcome: "accepted_idempotent" }
  | { outcome: "rejected_stale"; staleCause: "approval_state_mismatch" | "post_row_changed" };

export function postUpdatedAtMatchesSnapshot(iso: string, postUpdatedAtServer: Date): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t === postUpdatedAtServer.getTime();
}

export function isDuplicateApprovalDecision(args: {
  prev: ParsedPublishApprovalUtm;
  nextStatus: RevenueOsPublishApprovalStatus;
  clientReason: string | null;
}): boolean {
  const { prev, nextStatus, clientReason } = args;
  if (prev.status === "approved" && nextStatus === "approved") return true;
  if (prev.status === "rejected" && nextStatus === "rejected") {
    return (prev.approvalReason ?? "").trim() === (clientReason ?? "").trim();
  }
  return false;
}

export function evaluatePublishApprovalWrite(args: {
  nextStatus: RevenueOsPublishApprovalStatus;
  prevParsed: ParsedPublishApprovalUtm;
  clientReason: string | null;
  snapshot?: ApprovalReviewSnapshotInput;
  postUpdatedAtServer: Date;
  serverAwaitingChainStepIndex?: number;
}): EvaluatePublishApprovalWriteResult {
  if (
    isDuplicateApprovalDecision({
      prev: args.prevParsed,
      nextStatus: args.nextStatus,
      clientReason: args.clientReason,
    })
  ) {
    return { outcome: "accepted_idempotent" };
  }

  if (args.snapshot) {
    if (args.snapshot.expectedApprovalStatus !== args.prevParsed.status) {
      return { outcome: "rejected_stale", staleCause: "approval_state_mismatch" };
    }
    if (!postUpdatedAtMatchesSnapshot(args.snapshot.postUpdatedAt, args.postUpdatedAtServer)) {
      return { outcome: "rejected_stale", staleCause: "post_row_changed" };
    }
    if (
      args.snapshot.expectedApprovalStepIndex != null &&
      args.serverAwaitingChainStepIndex != null &&
      args.snapshot.expectedApprovalStepIndex !== args.serverAwaitingChainStepIndex
    ) {
      return { outcome: "rejected_stale", staleCause: "approval_state_mismatch" };
    }
  }

  return { outcome: "accepted_fresh" };
}
