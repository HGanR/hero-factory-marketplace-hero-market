/**
 * Normalized campaign governance/settings view-model for operator UI (Part 27).
 */

import type { PublishApprovalChain } from "@/lib/revenue-os/publish-approval-chain";
import { isMultiStepPublishApprovalChain } from "@/lib/revenue-os/publish-approval-chain";
import type { CampaignGovernanceEntitlements } from "@/lib/revenue-os/campaign-governance-entitlements";
import {
  computeCampaignGovernanceHealth,
  type CampaignGovernanceReviewerRoleCounts,
  type CampaignGovernanceSummaryView,
  type GovernanceHealthWarning,
} from "@/lib/revenue-os/campaign-governance-health";
import type { PublishApprovalReportSchedulePublic } from "@/lib/revenue-os/publish-approval-report-schedule";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

export type CampaignGovernanceChainMode = "off" | "default_single" | "explicit_single" | "multi";

export type CampaignGovernanceSettingsViewModel = {
  approvalMode: {
    workerEnvRequiresApproval: boolean;
    uiSessionRequiresApproval: boolean;
    effectiveRequiresApproval: boolean;
    /** One-line explanation for operators. */
    summaryLine: string;
  };
  chain: {
    mode: CampaignGovernanceChainMode;
    stepCount: number;
    /** True when an explicit chain JSON exists with at least one step. */
    explicitChainConfigured: boolean;
    label: string;
  };
  reportSchedule: {
    hasPersistedConfig: boolean;
    enabled: boolean;
    frequency: string | null;
    format: string | null;
    recipientMode: string | null;
    label: string;
  };
  reviewers: CampaignGovernanceReviewerRoleCounts & {
    breakdownLine: string;
  };
  /** Same rows as governance status block (health summary lines). */
  displaySummary: CampaignGovernanceSummaryView;
  warnings: GovernanceHealthWarning[];
  capabilities: {
    canManageReviewerAssignments: boolean;
    canViewApprovalAnalytics: boolean;
    mayFinalizePublishApproval: boolean;
    viewerCampaignReviewerRole: string;
  };
  entitlements: CampaignGovernanceEntitlements;
  governancePlanTierLabel: string;
  /** True when at least one entitlement flag is off (for plan upsell copy). */
  anyEntitlementGated: boolean;
  upgradeHintShort: string;
};

export const GOVERNANCE_PLAN_UPGRADE_HINT = "Available on higher plans.";

function buildApprovalModeSummaryLine(
  env: boolean,
  ui: boolean,
  effective: boolean
): string {
  if (!effective) {
    if (!env && !ui) return "Off — environment and UI session do not require approval.";
    return "Off (unexpected) — check worker and UI toggles.";
  }
  const parts: string[] = [];
  if (env) parts.push("environment");
  if (ui) parts.push("UI session toggle");
  return `On — required by ${parts.join(" + ")}.`;
}

function classifyChainMode(
  effectiveApproval: boolean,
  chain: PublishApprovalChain | null
): { mode: CampaignGovernanceChainMode; stepCount: number; explicit: boolean } {
  if (!effectiveApproval) {
    return { mode: "off", stepCount: 0, explicit: false };
  }
  const steps = chain?.steps?.length ?? 0;
  if (steps === 0) {
    return { mode: "default_single", stepCount: 0, explicit: false };
  }
  if (isMultiStepPublishApprovalChain(chain)) {
    return { mode: "multi", stepCount: steps, explicit: true };
  }
  return { mode: "explicit_single", stepCount: steps, explicit: true };
}

function buildReportScheduleSlice(
  schedule: PublishApprovalReportSchedulePublic | null
): CampaignGovernanceSettingsViewModel["reportSchedule"] {
  if (!schedule) {
    return {
      hasPersistedConfig: false,
      enabled: false,
      frequency: null,
      format: null,
      recipientMode: null,
      label: "Not configured",
    };
  }
  return {
    hasPersistedConfig: true,
    enabled: schedule.enabled,
    frequency: schedule.frequency,
    format: schedule.format,
    recipientMode: schedule.recipientMode,
    label: schedule.enabled
      ? `${schedule.frequency} · ${schedule.format} · ${schedule.recipientMode.replace(/_/g, " ")}`
      : "Configured but off",
  };
}

export function buildCampaignGovernanceSettingsViewModel(args: {
  workerEnvRequiresApproval: boolean;
  uiSessionRequiresApproval: boolean;
  publishApprovalChain: PublishApprovalChain | null;
  publishApprovalReportSchedule: PublishApprovalReportSchedulePublic | null;
  reviewerRoleCounts: CampaignGovernanceReviewerRoleCounts;
  rows: RevenueOsPublishWorkflowRow[];
  /** Viewer-specific flags from GET /api/campaigns/:id */
  canManageReviewerAssignments: boolean;
  canViewApprovalAnalytics: boolean;
  mayFinalizePublishApproval: boolean;
  viewerCampaignReviewerRole: string;
  entitlements: CampaignGovernanceEntitlements;
  governancePlanTierLabel: string;
}): CampaignGovernanceSettingsViewModel {
  const effective =
    args.workerEnvRequiresApproval || args.uiSessionRequiresApproval;

  const health = computeCampaignGovernanceHealth({
    effectiveApprovalRequired: effective,
    publishApprovalChain: args.publishApprovalChain,
    reviewerRoleCounts: args.reviewerRoleCounts,
    rows: args.rows,
    reportSchedule: args.publishApprovalReportSchedule,
  });

  const { mode, stepCount, explicit } = classifyChainMode(
    effective,
    args.publishApprovalChain
  );

  const rc = args.reviewerRoleCounts;
  const breakdownLine = `Owner (implicit) · approver ${rc.approver} · editor ${rc.editor} · reviewer ${rc.reviewer}`;

  const e = args.entitlements;
  const anyEntitlementGated = Object.values(e).some((v) => v === false);

  return {
    approvalMode: {
      workerEnvRequiresApproval: args.workerEnvRequiresApproval,
      uiSessionRequiresApproval: args.uiSessionRequiresApproval,
      effectiveRequiresApproval: effective,
      summaryLine: buildApprovalModeSummaryLine(
        args.workerEnvRequiresApproval,
        args.uiSessionRequiresApproval,
        effective
      ),
    },
    chain: {
      mode,
      stepCount,
      explicitChainConfigured: explicit,
      label: health.summary.chainLabel,
    },
    reportSchedule: buildReportScheduleSlice(args.publishApprovalReportSchedule),
    reviewers: {
      ...rc,
      breakdownLine,
    },
    displaySummary: health.summary,
    warnings: health.warnings,
    capabilities: {
      canManageReviewerAssignments: args.canManageReviewerAssignments,
      canViewApprovalAnalytics: args.canViewApprovalAnalytics,
      mayFinalizePublishApproval: args.mayFinalizePublishApproval,
      viewerCampaignReviewerRole: args.viewerCampaignReviewerRole,
    },
    entitlements: e,
    governancePlanTierLabel: args.governancePlanTierLabel,
    anyEntitlementGated,
    upgradeHintShort: GOVERNANCE_PLAN_UPGRADE_HINT,
  };
}
