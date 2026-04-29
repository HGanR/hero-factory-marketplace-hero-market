"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { CampaignGovernanceSettingsViewModel } from "@/lib/revenue-os/campaign-governance-settings-view-model";
import { CampaignGovernanceOperatorHelp } from "@/components/revenue-os/CampaignGovernanceOperatorHelp";
import { CampaignGovernanceStatusBlock } from "@/components/revenue-os/CampaignGovernanceStatusBlock";
import { cn } from "@/lib/utils";

type Props = {
  viewModel: CampaignGovernanceSettingsViewModel;
  className?: string;
  /** Optional compact actions (refresh analytics, etc.). */
  children?: ReactNode;
};

/**
 * Read-mostly campaign governance snapshot + quick navigation + operator help (Part 27).
 */
export function CampaignGovernanceSettingsSection({ viewModel, className, children }: Props) {
  const { capabilities, entitlements } = viewModel;

  return (
    <div
      className={cn("mt-3 space-y-2", className)}
      data-testid="campaign-governance-settings-section"
    >
      {viewModel.anyEntitlementGated ? (
        <p
          className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-100/90"
          data-testid="governance-plan-upgrade-hint"
        >
          {viewModel.upgradeHintShort} Some governance add-ons are not included on this plan.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Campaign governance &amp; settings
        </p>
        {children ? (
          <div className="flex flex-wrap gap-1.5" data-testid="campaign-governance-settings-actions">
            {children}
          </div>
        ) : null}
      </div>

      <CampaignGovernanceStatusBlock summary={viewModel.displaySummary} warnings={viewModel.warnings} />

      <dl
        className="rounded-lg border border-slate-800/70 bg-slate-950/25 px-2 py-2 text-[10px] text-slate-400 grid gap-1.5 sm:grid-cols-2"
        data-testid="campaign-governance-settings-detail"
      >
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Approval mode</dt>
          <dd className="text-slate-200 mt-0.5">{viewModel.approvalMode.summaryLine}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Chain mode</dt>
          <dd className="text-slate-200 mt-0.5 capitalize">{viewModel.chain.mode.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Report schedule</dt>
          <dd className="text-slate-200 mt-0.5">{viewModel.reportSchedule.label}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {capabilities.canManageReviewerAssignments ? (
          entitlements.reviewerAssignmentsEnabled ? (
            <Link
              href="/revenue-os/dashboard#bentley-deployment-readiness"
              className="text-cyan-300/90 underline hover:text-cyan-200"
              data-testid="governance-link-reviewers"
            >
              Manage reviewers
            </Link>
          ) : (
            <span className="text-slate-500" data-testid="governance-link-reviewers-gated">
              Manage reviewers — {viewModel.upgradeHintShort}
            </span>
          )
        ) : null}
        {capabilities.canViewApprovalAnalytics ? (
          entitlements.scheduledReportDeliveryEnabled ? (
            <a
              href="#publish-approval-report-schedule"
              className="text-cyan-300/90 underline hover:text-cyan-200"
              data-testid="governance-link-report-schedule"
            >
              Jump to report schedule
            </a>
          ) : (
            <span className="text-slate-500" data-testid="governance-link-report-schedule-gated">
              Scheduled reports — {viewModel.upgradeHintShort}
            </span>
          )
        ) : null}
        <a
          href="#bentley-publish-workflow-review"
          className="text-slate-500 underline hover:text-slate-400"
          data-testid="governance-link-workflow"
        >
          Workflow panel
        </a>
      </div>

      <CampaignGovernanceOperatorHelp showPlanUpgradeNote={viewModel.anyEntitlementGated} />
    </div>
  );
}
