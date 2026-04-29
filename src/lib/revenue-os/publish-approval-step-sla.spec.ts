import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import type { ParsedPublishApprovalUtm } from "@/lib/revenue-os/publish-approval-utm";
import {
  buildPublishApprovalStepSlaRowView,
  computePendingStepAgeMs,
  formatApprovalStepAgeShortLabel,
  isPendingStepOverdue,
  PUBLISH_APPROVAL_STEP_SLA_OVERDUE_AFTER_MS,
  resolveLogicalAwaitingStepIndex,
  shouldEmitSlaReminderForPendingStep,
} from "@/lib/revenue-os/publish-approval-step-sla";

function baseParsed(over: Partial<ParsedPublishApprovalUtm>): ParsedPublishApprovalUtm {
  return {
    status: "pending_approval",
    approvedAt: null,
    approvedBy: null,
    approvalReason: null,
    decidedAt: null,
    decidedByUserId: null,
    actorRole: null,
    currentApprovalStepIndex: null,
    totalApprovalSteps: null,
    currentApprovalRequiredRole: null,
    approvalStepStartedAt: null,
    slaReminderSentForLogicalStep: null,
    ...over,
  };
}

describe("computePendingStepAgeMs", () => {
  it("returns null when step start missing", () => {
    expect(computePendingStepAgeMs({ nowMs: 1e12, stepStartedAtIso: null })).toBeNull();
  });

  it("computes positive age", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const nowMs = Date.parse("2026-01-03T00:00:00.000Z");
    expect(computePendingStepAgeMs({ nowMs, stepStartedAtIso: start })).toBe(2 * 24 * 3600000);
  });
});

describe("isPendingStepOverdue", () => {
  const policy = { overdueAfterMs: 48 * 3600000 };

  it("is false under SLA window", () => {
    const nowMs = Date.parse("2026-01-02T00:00:00.000Z");
    expect(
      isPendingStepOverdue({
        nowMs,
        stepStartedAtIso: "2026-01-01T12:00:00.000Z",
        policy,
      })
    ).toBe(false);
  });

  it("is true past SLA window", () => {
    const nowMs = Date.parse("2026-01-05T00:00:00.000Z");
    expect(
      isPendingStepOverdue({
        nowMs,
        stepStartedAtIso: "2026-01-01T00:00:00.000Z",
        policy,
      })
    ).toBe(true);
  });
});

describe("shouldEmitSlaReminderForPendingStep", () => {
  const policy = { overdueAfterMs: PUBLISH_APPROVAL_STEP_SLA_OVERDUE_AFTER_MS };
  const started = "2020-01-01T00:00:00.000Z";
  const nowMs = Date.parse("2026-01-15T00:00:00.000Z");

  it("emits once per logical step when overdue", () => {
    expect(
      shouldEmitSlaReminderForPendingStep({
        effectiveApprovalStatus: "pending_approval",
        nowMs,
        stepStartedAtIso: started,
        slaReminderSentForLogicalStep: null,
        logicalAwaitingStepIndex: 0,
        policy,
      })
    ).toBe(true);

    expect(
      shouldEmitSlaReminderForPendingStep({
        effectiveApprovalStatus: "pending_approval",
        nowMs,
        stepStartedAtIso: started,
        slaReminderSentForLogicalStep: 0,
        logicalAwaitingStepIndex: 0,
        policy,
      })
    ).toBe(false);
  });

  it("emits again after step advances (reminder key reset semantics)", () => {
    expect(
      shouldEmitSlaReminderForPendingStep({
        effectiveApprovalStatus: "pending_approval",
        nowMs,
        stepStartedAtIso: started,
        slaReminderSentForLogicalStep: 0,
        logicalAwaitingStepIndex: 1,
        policy,
      })
    ).toBe(true);
  });

  it("does not emit when not pending", () => {
    expect(
      shouldEmitSlaReminderForPendingStep({
        effectiveApprovalStatus: "approved",
        nowMs,
        stepStartedAtIso: started,
        slaReminderSentForLogicalStep: null,
        logicalAwaitingStepIndex: 0,
        policy,
      })
    ).toBe(false);
  });
});

describe("resolveLogicalAwaitingStepIndex", () => {
  const chain = parseCampaignPublishApprovalChainJson({
    steps: [
      { stepIndex: 0, requiredReviewerRole: "editor" },
      { stepIndex: 1, requiredReviewerRole: "approver" },
    ],
  })!;

  it("uses 0 for single-step / no chain", () => {
    expect(
      resolveLogicalAwaitingStepIndex({
        publishApprovalChain: null,
        parsed: baseParsed({}),
      })
    ).toBe(0);
  });

  it("uses chain clamp for multi-step", () => {
    expect(
      resolveLogicalAwaitingStepIndex({
        publishApprovalChain: chain,
        parsed: baseParsed({
          currentApprovalStepIndex: 1,
          totalApprovalSteps: 2,
          currentApprovalRequiredRole: "approver",
        }),
      })
    ).toBe(1);
  });
});

describe("buildPublishApprovalStepSlaRowView", () => {
  const chain = parseCampaignPublishApprovalChainJson({
    steps: [
      { stepIndex: 0, requiredReviewerRole: "editor" },
      { stepIndex: 1, requiredReviewerRole: "approver" },
    ],
  })!;

  it("marks overdue on row view when past policy", () => {
    const nowMs = Date.parse("2026-02-10T00:00:00.000Z");
    const v = buildPublishApprovalStepSlaRowView({
      effectiveApprovalStatus: "pending_approval",
      publishApprovalChain: chain,
      parsed: baseParsed({
        approvalStepStartedAt: "2026-01-01T00:00:00.000Z",
        currentApprovalStepIndex: 0,
        totalApprovalSteps: 2,
        currentApprovalRequiredRole: "editor",
      }),
      nowMs,
      includeDebug: true,
      policy: { overdueAfterMs: 48 * 3600000 },
    });
    expect(v.approvalStepOverdue).toBe(true);
    expect(v.approvalStepAgeShortLabel).toBeTruthy();
    expect(v.approvalStepSlaDebug?.reminderEligible).toBe(true);
  });
});

describe("formatApprovalStepAgeShortLabel", () => {
  it("formats hours then days", () => {
    expect(formatApprovalStepAgeShortLabel(5 * 3600000)).toBe("5h");
    expect(formatApprovalStepAgeShortLabel(100 * 3600000)).toMatch(/^\d+d$/);
  });
});
