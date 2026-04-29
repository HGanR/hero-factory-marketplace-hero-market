/**
 * SLA view for multi-step publish approval (age, overdue, reminder eligibility).
 */

import {
  clampAwaitingChainStepIndex,
  isMultiStepPublishApprovalChain,
  type PublishApprovalChain,
} from "@/lib/revenue-os/publish-approval-chain";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import type { ParsedPublishApprovalUtm } from "@/lib/revenue-os/publish-approval-utm";

/** Default: posts pending longer than this are “overdue” for operator UX / reminders. */
export const PUBLISH_APPROVAL_STEP_SLA_OVERDUE_AFTER_MS = 48 * 3600000;

export type PublishApprovalStepSlaPolicy = {
  overdueAfterMs: number;
};

export function getPublishApprovalStepSlaPolicy(): PublishApprovalStepSlaPolicy {
  return { overdueAfterMs: PUBLISH_APPROVAL_STEP_SLA_OVERDUE_AFTER_MS };
}

export function computePendingStepAgeMs(args: { nowMs: number; stepStartedAtIso: string | null }): number | null {
  const raw = args.stepStartedAtIso?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const d = args.nowMs - t;
  return d >= 0 ? d : 0;
}

export function formatApprovalStepAgeShortLabel(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "0h";
  const hourMs = 3600000;
  const dayMs = 24 * hourMs;
  if (ageMs < dayMs) {
    const h = Math.max(1, Math.round(ageMs / hourMs));
    return `${h}h`;
  }
  const d = Math.floor(ageMs / dayMs);
  return `${d}d`;
}

export function isPendingStepOverdue(args: {
  nowMs: number;
  stepStartedAtIso: string | null;
  policy: PublishApprovalStepSlaPolicy;
}): boolean {
  const age = computePendingStepAgeMs({ nowMs: args.nowMs, stepStartedAtIso: args.stepStartedAtIso });
  if (age == null) return false;
  return age > args.policy.overdueAfterMs;
}

export function resolveLogicalAwaitingStepIndex(args: {
  publishApprovalChain: PublishApprovalChain | null;
  parsed: ParsedPublishApprovalUtm;
}): number {
  const ch = args.publishApprovalChain;
  if (!ch || !isMultiStepPublishApprovalChain(ch)) return 0;
  return clampAwaitingChainStepIndex(ch, args.parsed.currentApprovalStepIndex);
}

export function shouldEmitSlaReminderForPendingStep(args: {
  effectiveApprovalStatus: RevenueOsPublishApprovalStatus;
  nowMs: number;
  stepStartedAtIso: string | null;
  slaReminderSentForLogicalStep: number | null;
  logicalAwaitingStepIndex: number;
  policy: PublishApprovalStepSlaPolicy;
}): boolean {
  if (args.effectiveApprovalStatus !== "pending_approval") return false;
  if (
    !isPendingStepOverdue({
      nowMs: args.nowMs,
      stepStartedAtIso: args.stepStartedAtIso,
      policy: args.policy,
    })
  ) {
    return false;
  }
  const prev = args.slaReminderSentForLogicalStep;
  if (prev == null) return true;
  return prev !== args.logicalAwaitingStepIndex;
}

export type PublishApprovalStepSlaRowView = {
  approvalStepOverdue: boolean;
  approvalStepAgeMs: number | null;
  approvalStepAgeShortLabel: string | null;
  approvalStepSlaDebug?: {
    reminderEligible: boolean;
    logicalStep: number;
    policyMs: number;
  };
};

export function buildPublishApprovalStepSlaRowView(args: {
  effectiveApprovalStatus: RevenueOsPublishApprovalStatus;
  publishApprovalChain: PublishApprovalChain | null;
  parsed: ParsedPublishApprovalUtm;
  nowMs: number;
  includeDebug?: boolean;
  policy?: PublishApprovalStepSlaPolicy;
}): PublishApprovalStepSlaRowView {
  const policy = args.policy ?? { overdueAfterMs: PUBLISH_APPROVAL_STEP_SLA_OVERDUE_AFTER_MS };
  const stepStarted = args.parsed.approvalStepStartedAt?.trim() || null;
  const logicalStep = resolveLogicalAwaitingStepIndex({
    publishApprovalChain: args.publishApprovalChain,
    parsed: args.parsed,
  });

  if (args.effectiveApprovalStatus !== "pending_approval") {
    return {
      approvalStepOverdue: false,
      approvalStepAgeMs: null,
      approvalStepAgeShortLabel: null,
    };
  }

  const ageMs = computePendingStepAgeMs({ nowMs: args.nowMs, stepStartedAtIso: stepStarted });
  const overdue =
    stepStarted != null &&
    isPendingStepOverdue({
      nowMs: args.nowMs,
      stepStartedAtIso: stepStarted,
      policy,
    });

  const reminderEligible = shouldEmitSlaReminderForPendingStep({
    effectiveApprovalStatus: args.effectiveApprovalStatus,
    nowMs: args.nowMs,
    stepStartedAtIso: stepStarted,
    slaReminderSentForLogicalStep: args.parsed.slaReminderSentForLogicalStep ?? null,
    logicalAwaitingStepIndex: logicalStep,
    policy,
  });

  const short =
    ageMs != null ? formatApprovalStepAgeShortLabel(ageMs) : stepStarted ? "—" : null;

  const base: PublishApprovalStepSlaRowView = {
    approvalStepOverdue: overdue,
    approvalStepAgeMs: ageMs,
    approvalStepAgeShortLabel: short,
  };

  if (args.includeDebug) {
    base.approvalStepSlaDebug = {
      reminderEligible,
      logicalStep,
      policyMs: policy.overdueAfterMs,
    };
  }

  return base;
}
