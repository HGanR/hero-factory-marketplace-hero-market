import {
  mergePublishApprovalChainIntermediateIntoUtm,
  mergePublishApprovalGovernanceIntoUtm,
} from "@/lib/revenue-os/publish-approval-governance-merge";
import {
  BENTLEY_UTM_APPROVAL_BY_USER_ID,
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVED_AT,
  BENTLEY_UTM_APPROVED_BY,
  BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE,
  BENTLEY_UTM_APPROVAL_CHAIN_STEP,
  BENTLEY_UTM_APPROVAL_CHAIN_TOTAL,
  BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP,
  BENTLEY_UTM_APPROVAL_STEP_STARTED_AT,
} from "@/lib/revenue-os/publish-approval-utm";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";

const actorBacked: ResolvedPublishApprovalActor = {
  userId: 7,
  label: "tester",
  role: "owner",
  identityBacked: true,
};

const actorLocal: ResolvedPublishApprovalActor = {
  userId: null,
  label: "local_session",
  role: "operator",
  identityBacked: false,
};

describe("mergePublishApprovalGovernanceIntoUtm", () => {
  const now = "2026-04-01T12:00:00.000Z";

  it("approve persists actor identity when available", () => {
    const out = mergePublishApprovalGovernanceIntoUtm({
      base: {
        [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-01-01T00:00:00.000Z",
      },
      status: "approved",
      actor: actorBacked,
      nowIso: now,
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("approved");
    expect(out[BENTLEY_UTM_APPROVED_AT]).toBe(now);
    expect(out[BENTLEY_UTM_APPROVAL_BY_USER_ID]).toBe("7");
    expect(out[BENTLEY_UTM_APPROVED_BY]).toBe("tester");
    expect(out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]).toBeUndefined();
  });

  it("reject persists actor identity and reason", () => {
    const out = mergePublishApprovalGovernanceIntoUtm({
      base: {},
      status: "rejected",
      actor: actorBacked,
      nowIso: now,
      clientReason: "Not on brand",
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("rejected");
    expect(out.bentley_approval_reason).toBe("Not on brand");
    expect(out[BENTLEY_UTM_APPROVAL_BY_USER_ID]).toBe("7");
  });

  it("clear rejection returns to pending and strips identity fields", () => {
    const base = {
      [BENTLEY_UTM_APPROVAL_STATUS]: "rejected",
      [BENTLEY_UTM_APPROVAL_BY_USER_ID]: "7",
      [BENTLEY_UTM_APPROVED_BY]: "x",
      bentley_approval_reason: "bad",
      bentley_approval_decided_at: "old",
      [BENTLEY_UTM_APPROVED_AT]: "old2",
    };
    const out = mergePublishApprovalGovernanceIntoUtm({
      base,
      status: "pending_approval",
      actor: actorBacked,
      nowIso: now,
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
    expect(out[BENTLEY_UTM_APPROVAL_BY_USER_ID]).toBeUndefined();
    expect(out[BENTLEY_UTM_APPROVED_BY]).toBeUndefined();
    expect(out.bentley_approval_reason).toBeUndefined();
    expect(out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]).toBe(now);
  });

  it("local session actor does not write user id", () => {
    const out = mergePublishApprovalGovernanceIntoUtm({
      base: {},
      status: "approved",
      actor: actorLocal,
      nowIso: now,
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("approved");
    expect(out[BENTLEY_UTM_APPROVAL_BY_USER_ID]).toBeUndefined();
    expect(out[BENTLEY_UTM_APPROVED_BY]).toBeUndefined();
  });

  it("pending with chain seed writes chain progress keys", () => {
    const out = mergePublishApprovalGovernanceIntoUtm({
      base: {},
      status: "pending_approval",
      actor: actorBacked,
      nowIso: now,
      pendingChainSeed: { totalSteps: 2, stepIndex: 0, requiredRole: "editor" },
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
    expect(out[BENTLEY_UTM_APPROVAL_CHAIN_STEP]).toBe("0");
    expect(out[BENTLEY_UTM_APPROVAL_CHAIN_TOTAL]).toBe("2");
    expect(out[BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE]).toBe("editor");
    expect(out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]).toBe(now);
  });

  it("chain intermediate merge keeps pending and advances chain keys", () => {
    const out = mergePublishApprovalChainIntermediateIntoUtm({
      base: {
        bentley_approval_status: "pending_approval",
        bentley_approval_chain_step: "0",
        bentley_approval_chain_total: "2",
        bentley_approval_chain_required_role: "editor",
      },
      actor: actorBacked,
      nowIso: now,
      nextAwaitingStepIndex: 1,
      totalSteps: 2,
      nextRequiredRole: "approver",
    });
    expect(out[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
    expect(out[BENTLEY_UTM_APPROVAL_CHAIN_STEP]).toBe("1");
    expect(out[BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE]).toBe("approver");
    expect(out[BENTLEY_UTM_APPROVAL_BY_USER_ID]).toBe("7");
    expect(out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]).toBe(now);
  });
});
