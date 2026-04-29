import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

/** Compact production labels for publish-workflow SLA / overdue row chips. */
export function buildPublishWorkflowOverdueChip(args: {
  approvalStatus?: RevenueOsPublishWorkflowRow["approvalStatus"];
  approvalStepOverdue?: boolean;
  approvalStepAgeShortLabel?: string | null;
}): { show: boolean; title: string; text: string } {
  if (args.approvalStatus !== "pending_approval" || !args.approvalStepOverdue) {
    return { show: false, title: "", text: "" };
  }
  const age = args.approvalStepAgeShortLabel?.trim();
  const title = age ? `Overdue · waiting ${age}` : "Overdue on current approval step";
  const text = age ? `Overdue · ${age}` : "Overdue";
  return { show: true, title, text };
}
