/**
 * Merge server-resolved governance into utmParams for publish approval PATCH (additive).
 */

import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import {
  BENTLEY_UTM_APPROVAL_ACTOR_ROLE,
  BENTLEY_UTM_APPROVAL_BY_USER_ID,
  BENTLEY_UTM_APPROVAL_DECIDED_AT,
  BENTLEY_UTM_APPROVED_AT,
  BENTLEY_UTM_APPROVED_BY,
  BENTLEY_UTM_APPROVAL_REASON,
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP,
  BENTLEY_UTM_APPROVAL_STEP_STARTED_AT,
  clearPublishApprovalChainKeys,
  clearPublishApprovalStepSlaState,
  setPublishApprovalChainProgressKeys,
} from "@/lib/revenue-os/publish-approval-utm";

function deleteGovernanceIdentity(out: Record<string, string>) {
  delete out[BENTLEY_UTM_APPROVAL_BY_USER_ID];
  delete out[BENTLEY_UTM_APPROVAL_ACTOR_ROLE];
  delete out[BENTLEY_UTM_APPROVED_BY];
  delete out[BENTLEY_UTM_APPROVED_AT];
  delete out[BENTLEY_UTM_APPROVAL_DECIDED_AT];
  delete out[BENTLEY_UTM_APPROVAL_REASON];
}

function applyIdentity(out: Record<string, string>, actor: ResolvedPublishApprovalActor, nowIso: string) {
  out[BENTLEY_UTM_APPROVAL_DECIDED_AT] = nowIso;
  if (actor.identityBacked && actor.userId != null) {
    out[BENTLEY_UTM_APPROVAL_BY_USER_ID] = String(actor.userId);
    out[BENTLEY_UTM_APPROVED_BY] = actor.label;
    out[BENTLEY_UTM_APPROVAL_ACTOR_ROLE] = actor.role;
  } else if (actor.useLabelOnlyGovernance && actor.label.trim()) {
    delete out[BENTLEY_UTM_APPROVAL_BY_USER_ID];
    out[BENTLEY_UTM_APPROVED_BY] = actor.label.trim().slice(0, 200);
    out[BENTLEY_UTM_APPROVAL_ACTOR_ROLE] = actor.role;
  } else {
    delete out[BENTLEY_UTM_APPROVAL_BY_USER_ID];
    delete out[BENTLEY_UTM_APPROVAL_ACTOR_ROLE];
    delete out[BENTLEY_UTM_APPROVED_BY];
  }
}

export type PendingApprovalChainSeed = {
  totalSteps: number;
  stepIndex: number;
  requiredRole: PublishApprovalChainRequiredRole;
};

/**
 * Apply approval status + governance fields. Caller supplies merged `base` (prev UTM + client utmParams patch).
 */
export function mergePublishApprovalGovernanceIntoUtm(args: {
  base: Record<string, string>;
  status: RevenueOsPublishApprovalStatus;
  actor: ResolvedPublishApprovalActor;
  nowIso: string;
  /** Client-provided reason (reject). Ignored for approve when clearing. */
  clientReason?: string | null;
  /** When entering `pending_approval` with a multi-step chain, seed progress keys (step awaiting action). */
  pendingChainSeed?: PendingApprovalChainSeed | null;
}): Record<string, string> {
  const out = { ...args.base };
  const { status, actor, nowIso } = args;

  out[BENTLEY_UTM_APPROVAL_STATUS] = status;

  if (status === "pending_approval") {
    deleteGovernanceIdentity(out);
    if (args.pendingChainSeed) {
      setPublishApprovalChainProgressKeys(out, {
        stepIndex: args.pendingChainSeed.stepIndex,
        totalSteps: args.pendingChainSeed.totalSteps,
        requiredRole: args.pendingChainSeed.requiredRole,
      });
    } else {
      clearPublishApprovalChainKeys(out);
    }
    clearPublishApprovalStepSlaState(out);
    out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT] = nowIso;
    return out;
  }

  clearPublishApprovalChainKeys(out);
  clearPublishApprovalStepSlaState(out);

  if (status === "not_required") {
    applyIdentity(out, actor, nowIso);
    delete out[BENTLEY_UTM_APPROVAL_REASON];
    return out;
  }

  if (status === "approved") {
    delete out[BENTLEY_UTM_APPROVAL_REASON];
    out[BENTLEY_UTM_APPROVED_AT] = nowIso;
    applyIdentity(out, actor, nowIso);
    return out;
  }

  if (status === "rejected") {
    applyIdentity(out, actor, nowIso);
    const r = args.clientReason?.trim();
    if (r) out[BENTLEY_UTM_APPROVAL_REASON] = r.slice(0, 500);
    else delete out[BENTLEY_UTM_APPROVAL_REASON];
    return out;
  }

  return out;
}

/**
 * After a non-final chain step is accepted: remain `pending_approval`, record the actor, advance awaiting step.
 */
export function mergePublishApprovalChainIntermediateIntoUtm(args: {
  base: Record<string, string>;
  actor: ResolvedPublishApprovalActor;
  nowIso: string;
  nextAwaitingStepIndex: number;
  totalSteps: number;
  nextRequiredRole: PublishApprovalChainRequiredRole;
}): Record<string, string> {
  const out = { ...args.base };
  out[BENTLEY_UTM_APPROVAL_STATUS] = "pending_approval";
  delete out[BENTLEY_UTM_APPROVED_AT];
  applyIdentity(out, args.actor, args.nowIso);
  setPublishApprovalChainProgressKeys(out, {
    stepIndex: args.nextAwaitingStepIndex,
    totalSteps: args.totalSteps,
    requiredRole: args.nextRequiredRole,
  });
  delete out[BENTLEY_UTM_APPROVAL_REASON];
  delete out[BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP];
  out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT] = args.nowIso;
  return out;
}
