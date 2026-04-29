"use client";

import { cn } from "@/lib/utils";

type Props = { className?: string; showPlanUpgradeNote?: boolean };

/**
 * Compact expandable operator guidance (Part 27).
 */
export function CampaignGovernanceOperatorHelp({ className, showPlanUpgradeNote }: Props) {
  return (
    <details
      className={cn(
        "mt-2 rounded border border-slate-800/80 bg-slate-950/30 px-2 py-1.5 text-[10px] text-slate-400",
        className
      )}
      data-testid="campaign-governance-operator-help"
    >
      <summary className="cursor-pointer text-slate-300 select-none">How governance works</summary>
      <div className="mt-2 space-y-2 border-t border-slate-800/70 pt-2">
        {showPlanUpgradeNote ? (
          <p className="text-amber-200/85" data-testid="governance-help-plan-gate">
            Plan note: some advanced governance tools (reviewers, multi-step chains, analytics, scheduled reports, exports)
            may require a higher tier. Use airos_debug to inspect resolved entitlements.
          </p>
        ) : null}
        <section data-testid="governance-help-reviewers">
          <p className="font-medium text-slate-300">Reviewer roles</p>
          <p className="mt-0.5">
            <span className="text-slate-500">Owner</span> is implicit on the campaign.{" "}
            <span className="text-slate-500">Approver</span> and <span className="text-slate-500">editor</span> can
            finalize publish approvals. <span className="text-slate-500">Reviewer</span> can review but not finalize.
            Assign collaborators under Deployment readiness → Campaign reviewers.
          </p>
        </section>
        <section data-testid="governance-help-chains">
          <p className="font-medium text-slate-300">Approval chains</p>
          <p className="mt-0.5">
            Multi-step chains define ordered roles (owner / approver / editor) per step. The active step is driven by
            post UTM metadata. Configure the chain via{" "}
            <code className="text-cyan-200/80">PATCH /api/campaigns/&lt;id&gt;</code> with{" "}
            <code className="text-cyan-200/80">publishApprovalChain</code> (owner/admin).
          </p>
        </section>
        <section data-testid="governance-help-reports">
          <p className="font-medium text-slate-300">Report schedules</p>
          <p className="mt-0.5">
            Scheduled compliance reports send in-app reminders when a UTC window opens (daily or weekly). Recipients
            can be owner only or owner plus assigned reviewers. Export files separately via the report buttons or API.
          </p>
        </section>
        <section data-testid="governance-help-sla">
          <p className="font-medium text-slate-300">SLA &amp; overdue reminders</p>
          <p className="mt-0.5">
            When approval is required, pending posts can trigger SLA-based overdue chips in this panel. Background scans
            (internal cron) may send reminder notifications; they do not auto-approve or change decisions.
          </p>
        </section>
      </div>
    </details>
  );
}
