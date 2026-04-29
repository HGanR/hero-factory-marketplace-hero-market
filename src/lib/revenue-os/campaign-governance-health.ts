/**
 * Informational governance health for campaigns (Part 25).
 * Does not gate approvals — UI hints only.
 */

import type { PublishApprovalChain, PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import { isMultiStepPublishApprovalChain } from "@/lib/revenue-os/publish-approval-chain";
import type { PublishApprovalReportSchedulePublic } from "@/lib/revenue-os/publish-approval-report-schedule";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

export type CampaignGovernanceReviewerRoleCounts = {
  approver: number;
  editor: number;
  reviewer: number;
};

export type GovernanceHealthWarningCode =
  | "CHAIN_STEP_NO_ASSIGNEE"
  | "REPORT_NO_EXTRA_RECIPIENTS"
  | "PENDING_NO_STEP_ASSIGNEE";

export type GovernanceHealthWarning = {
  code: GovernanceHealthWarningCode;
  message: string;
};

export type CampaignGovernanceSummaryView = {
  approvalRequiredLabel: string;
  chainLabel: string;
  reportDeliveryLabel: string;
  reviewerCountsLine: string;
};

function hasEligibleAssigneeForChainRole(
  required: PublishApprovalChainRequiredRole,
  counts: CampaignGovernanceReviewerRoleCounts
): boolean {
  if (required === "owner") return true;
  if (required === "approver") return counts.approver > 0;
  if (required === "editor") return counts.editor > 0;
  return false;
}

function formatRole(required: PublishApprovalChainRequiredRole): string {
  return required;
}

function buildReportDeliveryLabel(schedule: PublishApprovalReportSchedulePublic | null): string {
  if (!schedule) return "Not configured";
  if (!schedule.enabled) return "Off";
  return `${schedule.frequency} · ${schedule.format} · ${schedule.recipientMode.replace(/_/g, " ")}`;
}

function buildChainLabel(
  effectiveApprovalRequired: boolean,
  chain: PublishApprovalChain | null
): string {
  if (!effectiveApprovalRequired) return "— (approval not required)";
  if (!chain?.steps?.length) return "Single-step (default)";
  if (isMultiStepPublishApprovalChain(chain)) return `${chain.steps.length}-step chain`;
  return "Single-step";
}

function buildReviewerCountsLine(counts: CampaignGovernanceReviewerRoleCounts): string {
  return `Owner (implicit) · approver ${counts.approver} · editor ${counts.editor} · reviewer ${counts.reviewer}`;
}

export function computeCampaignGovernanceHealth(args: {
  effectiveApprovalRequired: boolean;
  publishApprovalChain: PublishApprovalChain | null;
  reviewerRoleCounts: CampaignGovernanceReviewerRoleCounts;
  rows: RevenueOsPublishWorkflowRow[];
  reportSchedule: PublishApprovalReportSchedulePublic | null;
}): { warnings: GovernanceHealthWarning[]; summary: CampaignGovernanceSummaryView } {
  const {
    effectiveApprovalRequired,
    publishApprovalChain: chain,
    reviewerRoleCounts: counts,
    rows,
    reportSchedule,
  } = args;

  const warnings: GovernanceHealthWarning[] = [];

  if (effectiveApprovalRequired && chain?.steps?.length) {
    const seen = new Set<PublishApprovalChainRequiredRole>();
    for (const step of chain.steps) {
      const req = step.requiredReviewerRole;
      if (seen.has(req)) continue;
      seen.add(req);
      if (!hasEligibleAssigneeForChainRole(req, counts)) {
        warnings.push({
          code: "CHAIN_STEP_NO_ASSIGNEE",
          message: `Approval chain includes a “${formatRole(req)}” step, but no assigned reviewer matches that role (owner is implicit only for owner steps).`,
        });
      }
    }
  }

  if (reportSchedule?.enabled && reportSchedule.recipientMode === "owner_and_admins") {
    const n = counts.approver + counts.editor + counts.reviewer;
    if (n === 0) {
      warnings.push({
        code: "REPORT_NO_EXTRA_RECIPIENTS",
        message:
          "Scheduled reports use “owner + assigned reviewers,” but there are no reviewer assignments — only the campaign owner will receive deliveries.",
      });
    }
  }

  if (effectiveApprovalRequired) {
    const missingRoles = new Set<PublishApprovalChainRequiredRole>();
    for (const r of rows) {
      if (r.approvalStatus !== "pending_approval") continue;
      const req = r.currentApprovalRequiredRole;
      if (req == null) continue;
      if (!hasEligibleAssigneeForChainRole(req, counts)) {
        missingRoles.add(req);
      }
    }
    for (const req of missingRoles) {
      warnings.push({
        code: "PENDING_NO_STEP_ASSIGNEE",
        message: `Some posts are pending approval for a “${formatRole(req)}” step, but no assigned reviewer has that role.`,
      });
    }
  }

  const summary: CampaignGovernanceSummaryView = {
    approvalRequiredLabel: effectiveApprovalRequired ? "On" : "Off",
    chainLabel: buildChainLabel(effectiveApprovalRequired, chain),
    reportDeliveryLabel: buildReportDeliveryLabel(reportSchedule),
    reviewerCountsLine: buildReviewerCountsLine(counts),
  };

  const deduped = dedupeWarnings(warnings);
  return { warnings: deduped, summary };
}

function dedupeWarnings(warnings: GovernanceHealthWarning[]): GovernanceHealthWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    if (seen.has(w.message)) return false;
    seen.add(w.message);
    return true;
  });
}
