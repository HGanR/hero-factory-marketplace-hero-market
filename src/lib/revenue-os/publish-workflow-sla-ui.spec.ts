import { buildPublishWorkflowOverdueChip } from "@/lib/revenue-os/publish-workflow-sla-ui";

describe("buildPublishWorkflowOverdueChip", () => {
  it("hides when not pending or not overdue", () => {
    expect(buildPublishWorkflowOverdueChip({ approvalStatus: "approved", approvalStepOverdue: true }).show).toBe(
      false
    );
    expect(
      buildPublishWorkflowOverdueChip({ approvalStatus: "pending_approval", approvalStepOverdue: false }).show
    ).toBe(false);
  });

  it("shows overdue with optional age", () => {
    const a = buildPublishWorkflowOverdueChip({
      approvalStatus: "pending_approval",
      approvalStepOverdue: true,
      approvalStepAgeShortLabel: "52h",
    });
    expect(a.show).toBe(true);
    expect(a.text).toContain("Overdue");
    expect(a.text).toContain("52h");
    expect(a.title).toContain("52h");
  });
});
