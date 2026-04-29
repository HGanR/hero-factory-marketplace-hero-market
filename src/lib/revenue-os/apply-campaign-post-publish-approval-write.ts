/**
 * Shared publish-approval UTM merge + audit payload for campaign posts.
 * Used by internal PATCH and external client review API (same governance semantics).
 */

import type { campaignPosts, campaigns } from "@/lib/db/schema";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import { userCanActOnApprovalChainStep } from "@/lib/revenue-os/campaign-reviewer-role";
import {
  clampAwaitingChainStepIndex,
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
} from "@/lib/revenue-os/publish-approval-chain";
import {
  mergePublishApprovalChainIntermediateIntoUtm,
  mergePublishApprovalGovernanceIntoUtm,
} from "@/lib/revenue-os/publish-approval-governance-merge";
import { resolvePublishApprovalAuditAction } from "@/lib/revenue-os/publish-approval-audit";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import {
  evaluatePublishApprovalWrite,
  type ApprovalReviewSnapshotInput,
} from "@/lib/revenue-os/publish-approval-patch-guard";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

export type PublishApprovalNotifyCtx =
  | { kind: "final"; actor: ResolvedPublishApprovalActor; decision: "approved" | "rejected" }
  | {
      kind: "chain_advanced";
      actor: ResolvedPublishApprovalActor;
      completedStepIndex: number;
      totalSteps: number;
      nextAwaitingStepIndex: number;
      nextRequiredRole: string;
    };

export type ApplyCampaignPostPublishApprovalWriteResult =
  | { outcome: "accepted_idempotent" }
  | {
      outcome: "accepted_fresh";
      mergedUtm: Record<string, string>;
      auditAction: string;
      auditDetails: Record<string, unknown>;
      publishApprovalNotify?: PublishApprovalNotifyCtx;
      parsedBentleyApprovalReason: string | null;
    }
  | { outcome: "rejected_stale"; staleCause: "approval_state_mismatch" | "post_row_changed" }
  | { outcome: "step_blocked"; message: string };

/**
 * Compute merged UTM + audit metadata for an approval/reject decision (no DB I/O).
 */
export function applyCampaignPostPublishApprovalWrite(args: {
  post: typeof campaignPosts.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  prevUtm: Record<string, string> | null;
  bentleyApprovalStatus: RevenueOsPublishApprovalStatus;
  bentleyApprovalReason: string | null | undefined;
  approvalReviewSnapshot?: ApprovalReviewSnapshotInput | null;
  actor: ResolvedPublishApprovalActor;
  /** Used with `userCanActOnApprovalChainStep` (e.g. internal reviewer role or virtual `approver` for client links). */
  reviewerRoleForChainGate: CampaignReviewerRole;
  adminSession?: boolean;
  /** Extra fields merged into audit `details` (e.g. external review provenance). */
  auditDetailsExtra?: Record<string, unknown>;
  /** Merged into UTM base before governance (internal PATCH may send `utmParams` alongside approval). */
  utmParamsPatch?: Record<string, string> | null;
}): ApplyCampaignPostPublishApprovalWriteResult {
  const {
    post,
    campaign,
    prevUtm,
    bentleyApprovalStatus,
    bentleyApprovalReason,
    approvalReviewSnapshot,
    actor,
    reviewerRoleForChainGate,
    adminSession,
    auditDetailsExtra,
    utmParamsPatch,
  } = args;

  const chain = parseCampaignPublishApprovalChainJson(campaign.publishApprovalChainJson);
  const prevParsed = parsePublishApprovalFromUtm(prevUtm);

  const serverAwaitingChainStepIndex =
    isMultiStepPublishApprovalChain(chain) && prevParsed.status === "pending_approval"
      ? clampAwaitingChainStepIndex(chain, prevParsed.currentApprovalStepIndex)
      : null;

  if (
    bentleyApprovalStatus === "approved" &&
    prevParsed.status === "pending_approval" &&
    chain &&
    isMultiStepPublishApprovalChain(chain)
  ) {
    const awaiting = clampAwaitingChainStepIndex(chain, prevParsed.currentApprovalStepIndex);
    const stepRole = requiredReviewerRoleForChainStep(chain, awaiting);
    if (stepRole && !userCanActOnApprovalChainStep(reviewerRoleForChainGate, stepRole, { adminSession })) {
      return {
        outcome: "step_blocked",
        message: `This post is awaiting a ${stepRole} for approval step ${awaiting + 1} of ${chain.steps.length}.`,
      };
    }
  }

  const evaluation = evaluatePublishApprovalWrite({
    nextStatus: bentleyApprovalStatus,
    prevParsed,
    clientReason: bentleyApprovalReason ?? null,
    snapshot: approvalReviewSnapshot ?? undefined,
    postUpdatedAtServer: post.updatedAt,
    serverAwaitingChainStepIndex: serverAwaitingChainStepIndex != null ? serverAwaitingChainStepIndex : undefined,
  });

  if (evaluation.outcome === "accepted_idempotent") {
    return { outcome: "accepted_idempotent" };
  }
  if (evaluation.outcome === "rejected_stale") {
    return { outcome: "rejected_stale", staleCause: evaluation.staleCause };
  }

  const base = { ...(prevUtm ?? {}), ...(utmParamsPatch ?? {}) };
  const nowIso = new Date().toISOString();

  const multi = Boolean(chain && isMultiStepPublishApprovalChain(chain));
  const pendingMultiApprove =
    bentleyApprovalStatus === "approved" && prevParsed.status === "pending_approval" && multi && Boolean(chain);

  let merged: Record<string, string>;
  let auditNextStatus = bentleyApprovalStatus;
  let chainIntermediateAdvance = false;
  let publishApprovalNotify: PublishApprovalNotifyCtx | undefined;

  if (pendingMultiApprove && chain) {
    const awaiting = clampAwaitingChainStepIndex(chain, prevParsed.currentApprovalStepIndex);
    const lastIdx = chain.steps.length - 1;
    if (awaiting < lastIdx) {
      const nextReq = requiredReviewerRoleForChainStep(chain, awaiting + 1);
      if (!nextReq) {
        merged = mergePublishApprovalGovernanceIntoUtm({
          base,
          status: "approved",
          actor,
          nowIso,
          clientReason: null,
        });
        publishApprovalNotify = { kind: "final", actor, decision: "approved" };
      } else {
        merged = mergePublishApprovalChainIntermediateIntoUtm({
          base,
          actor,
          nowIso,
          nextAwaitingStepIndex: awaiting + 1,
          totalSteps: chain.steps.length,
          nextRequiredRole: nextReq,
        });
        auditNextStatus = "pending_approval";
        chainIntermediateAdvance = true;
        publishApprovalNotify = {
          kind: "chain_advanced",
          actor,
          completedStepIndex: awaiting,
          totalSteps: chain.steps.length,
          nextAwaitingStepIndex: awaiting + 1,
          nextRequiredRole: nextReq,
        };
      }
    } else {
      merged = mergePublishApprovalGovernanceIntoUtm({
        base,
        status: "approved",
        actor,
        nowIso,
        clientReason: null,
      });
      publishApprovalNotify = { kind: "final", actor, decision: "approved" };
    }
  } else if (bentleyApprovalStatus === "pending_approval" && multi && chain) {
    const first = requiredReviewerRoleForChainStep(chain, 0);
    merged = mergePublishApprovalGovernanceIntoUtm({
      base,
      status: "pending_approval",
      actor,
      nowIso,
      clientReason: bentleyApprovalReason ?? null,
      pendingChainSeed: first
        ? {
            totalSteps: chain.steps.length,
            stepIndex: 0,
            requiredRole: first,
          }
        : null,
    });
  } else {
    merged = mergePublishApprovalGovernanceIntoUtm({
      base,
      status: bentleyApprovalStatus,
      actor,
      nowIso,
      clientReason: bentleyApprovalReason ?? null,
    });
    if (bentleyApprovalStatus === "approved" || bentleyApprovalStatus === "rejected") {
      publishApprovalNotify = {
        kind: "final",
        actor,
        decision: bentleyApprovalStatus === "approved" ? "approved" : "rejected",
      };
    }
  }

  const auditAction = resolvePublishApprovalAuditAction({
    nextStatus: auditNextStatus,
    prevStatus: prevParsed.status,
    chainIntermediateAdvance,
  });

  const chainAuditDetails: Record<string, unknown> = {};
  if (
    multi &&
    chain &&
    prevParsed.status === "pending_approval" &&
    (bentleyApprovalStatus === "approved" || bentleyApprovalStatus === "rejected")
  ) {
    const awaitingBefore = clampAwaitingChainStepIndex(chain, prevParsed.currentApprovalStepIndex);
    const roleAtStep = requiredReviewerRoleForChainStep(chain, awaitingBefore);
    if (roleAtStep != null) {
      chainAuditDetails.approvalStepIndex = awaitingBefore;
      chainAuditDetails.approvalStepRole = roleAtStep;
      if (bentleyApprovalStatus === "rejected") {
        chainAuditDetails.chainCompleted = false;
      } else if (chainIntermediateAdvance) {
        chainAuditDetails.chainCompleted = false;
      } else {
        chainAuditDetails.chainCompleted = true;
      }
    }
  }

  const auditDetails: Record<string, unknown> = {
    decision: auditNextStatus,
    decidedByUserId: actor.userId,
    decidedByLabel: actor.label,
    actorRole: actor.role,
    reviewerRole: reviewerRoleForChainGate,
    identityBacked: actor.identityBacked,
    reason: merged["bentley_approval_reason"] ?? null,
    decidedAt: merged["bentley_approval_decided_at"] ?? merged["bentley_approved_at"] ?? nowIso,
    prevDecision: prevParsed.status,
    provenance: { write: "fresh" as const },
    ...chainAuditDetails,
    ...auditDetailsExtra,
  };

  return {
    outcome: "accepted_fresh",
    mergedUtm: merged,
    auditAction,
    auditDetails,
    publishApprovalNotify,
    parsedBentleyApprovalReason: bentleyApprovalReason?.trim() ?? null,
  };
}
