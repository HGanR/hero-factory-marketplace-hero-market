"use client";

import type { CampaignGovernanceSummaryView, GovernanceHealthWarning } from "@/lib/revenue-os/campaign-governance-health";
import { cn } from "@/lib/utils";

type Props = {
  summary: CampaignGovernanceSummaryView;
  warnings: GovernanceHealthWarning[];
  className?: string;
};

/**
 * Compact owner/admin governance snapshot + informational warnings (Part 25).
 */
export function CampaignGovernanceStatusBlock({ summary, warnings, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-800/90 bg-slate-900/35 px-3 py-2.5 text-[11px] text-slate-300",
        className
      )}
      data-testid="campaign-governance-status-block"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Governance status</p>
      <dl className="grid gap-1.5 sm:grid-cols-2" data-testid="campaign-governance-summary-dl">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-slate-500">Approval required</dt>
          <dd className="text-slate-200 font-medium" data-testid="governance-summary-approval">
            {summary.approvalRequiredLabel}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-slate-500">Publish chain</dt>
          <dd className="text-slate-200" data-testid="governance-summary-chain">
            {summary.chainLabel}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 sm:col-span-2">
          <dt className="text-slate-500">Report delivery</dt>
          <dd className="text-slate-200" data-testid="governance-summary-report">
            {summary.reportDeliveryLabel}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 sm:col-span-2">
          <dt className="text-slate-500">Reviewers</dt>
          <dd className="text-slate-200" data-testid="governance-summary-reviewers">
            {summary.reviewerCountsLine}
          </dd>
        </div>
      </dl>
      {warnings.length ? (
        <ul
          className="mt-2 space-y-1.5 border-t border-slate-800/80 pt-2 text-[10px] text-amber-200/90"
          data-testid="campaign-governance-warnings"
        >
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} data-testid={`governance-warning-${w.code}`}>
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
