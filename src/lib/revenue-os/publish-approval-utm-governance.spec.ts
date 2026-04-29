import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";

describe("parsePublishApprovalFromUtm governance fields", () => {
  it("parses decidedByUserId and actor role", () => {
    const p = parsePublishApprovalFromUtm({
      bentley_approval_status: "approved",
      bentley_approved_at: "2026-01-02T00:00:00.000Z",
      bentley_approval_decided_at: "2026-01-03T00:00:00.000Z",
      bentley_approved_by: "Ada",
      bentley_approval_by_user_id: "42",
      bentley_approval_actor_role: "owner",
    });
    expect(p.decidedByUserId).toBe(42);
    expect(p.actorRole).toBe("owner");
    expect(p.decidedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(p.approvedBy).toBe("Ada");
    expect(p.currentApprovalStepIndex).toBeNull();
  });

  it("parses multi-step chain progress keys", () => {
    const p = parsePublishApprovalFromUtm({
      bentley_approval_status: "pending_approval",
      bentley_approval_chain_step: "1",
      bentley_approval_chain_total: "2",
      bentley_approval_chain_required_role: "approver",
    });
    expect(p.currentApprovalStepIndex).toBe(1);
    expect(p.totalApprovalSteps).toBe(2);
    expect(p.currentApprovalRequiredRole).toBe("approver");
    expect(p.approvalStepStartedAt).toBeNull();
  });

  it("parses SLA step timing keys", () => {
    const p = parsePublishApprovalFromUtm({
      bentley_approval_status: "pending_approval",
      bentley_approval_step_started_at: "2026-02-01T08:00:00.000Z",
      bentley_approval_step_sla_reminder_for_step: "0",
    });
    expect(p.approvalStepStartedAt).toBe("2026-02-01T08:00:00.000Z");
    expect(p.slaReminderSentForLogicalStep).toBe(0);
  });
});
