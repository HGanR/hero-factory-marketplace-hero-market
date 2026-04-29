"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CampaignGovernanceEntitlements } from "@/lib/revenue-os/campaign-governance-entitlements";

type Props = {
  campaignId: string | null;
  workerEnvApproval: boolean;
  uiApprovalMode: boolean;
  viewerCampaignReviewerRole: string | null;
  viewerMayFinalizePublishApproval: boolean;
  viewerCanManageReviewerAssignments: boolean;
  viewerCanViewApprovalAnalytics: boolean;
  chainExplicitConfigured: boolean;
  chainStepCount: number;
  reportScheduleEnabled: boolean;
  refreshNonce: number;
  /** Resolved commercial tier label from campaign GET (Part 28). */
  governancePlanTierLabel?: string | null;
  governanceEntitlements?: CampaignGovernanceEntitlements | null;
  className?: string;
};

/**
 * airos_debug=1 support snapshot + latest internal job run fetch (Part 27).
 */
export function AirosDebugSupportSummary({
  campaignId,
  workerEnvApproval,
  uiApprovalMode,
  viewerCampaignReviewerRole,
  viewerMayFinalizePublishApproval,
  viewerCanManageReviewerAssignments,
  viewerCanViewApprovalAnalytics,
  chainExplicitConfigured,
  chainStepCount,
  reportScheduleEnabled,
  refreshNonce,
  governancePlanTierLabel,
  governanceEntitlements,
  className,
}: Props) {
  const [jobLogText, setJobLogText] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);

  const loadJobs = useCallback(async () => {
    setJobBusy(true);
    try {
      const r = await fetch("/api/internal/job-runs/recent?limit=5", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as unknown;
      setJobLogText(JSON.stringify(j, null, 2));
    } catch {
      setJobLogText('{"error":"fetch_failed"}');
    } finally {
      setJobBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs, refreshNonce]);

  return (
    <div
      className={cn(
        "mt-3 rounded border border-violet-900/40 bg-violet-950/20 px-2 py-2 text-[10px] text-violet-100/90 space-y-1.5",
        className
      )}
      data-testid="airos-debug-support-summary"
    >
      <div className="font-semibold text-violet-200/95 uppercase tracking-wide text-[9px]">Support / debug</div>
      <div data-testid="debug-support-campaign-id">
        campaign: <span className="font-mono text-violet-100">{campaignId ?? "—"}</span>
      </div>
      <div data-testid="debug-support-viewer-role">
        viewer role: <span className="font-mono">{viewerCampaignReviewerRole ?? "—"}</span> · mayFinalize=
        {viewerMayFinalizePublishApproval ? "yes" : "no"} · manageReviewers=
        {viewerCanManageReviewerAssignments ? "yes" : "no"} · viewAnalytics=
        {viewerCanViewApprovalAnalytics ? "yes" : "no"}
      </div>
      <div data-testid="debug-support-approval-gate">
        approval gate: env={workerEnvApproval ? "on" : "off"} · ui={uiApprovalMode ? "on" : "off"} · effective=
        {workerEnvApproval || uiApprovalMode ? "required" : "off"}
      </div>
      <div data-testid="debug-support-chain">
        chain: explicit={chainExplicitConfigured ? "yes" : "no"} · steps={chainStepCount}
      </div>
      <div data-testid="debug-support-report">
        report schedule enabled: {reportScheduleEnabled ? "yes" : "no"}
      </div>
      <div data-testid="debug-support-governance-tier">
        governance tier:{" "}
        <span className="font-mono text-violet-100">{governancePlanTierLabel?.trim() ? governancePlanTierLabel : "—"}</span>
      </div>
      <div data-testid="debug-support-governance-entitlements">
        governance entitlements:{" "}
        <span className="font-mono text-violet-100/95">
          {governanceEntitlements
            ? [
                `reviewers=${governanceEntitlements.reviewerAssignmentsEnabled ? "on" : "off"}`,
                `multiStep=${governanceEntitlements.multiStepApprovalChainsEnabled ? "on" : "off"}`,
                `analytics=${governanceEntitlements.approvalAnalyticsEnabled ? "on" : "off"}`,
                `scheduled=${governanceEntitlements.scheduledReportDeliveryEnabled ? "on" : "off"}`,
                `export=${governanceEntitlements.complianceReportExportEnabled ? "on" : "off"}`,
              ].join(" · ")
            : "—"}
        </span>
      </div>
      <div className="border-t border-violet-900/35 pt-1.5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-violet-300/90">Recent internal job runs</span>
          <button
            type="button"
            disabled={jobBusy}
            onClick={() => void loadJobs()}
            className="rounded border border-violet-800/60 px-1.5 py-0.5 text-[9px] text-violet-200 hover:bg-violet-950/50 disabled:opacity-40"
            data-testid="debug-support-refresh-job-runs"
          >
            {jobBusy ? "…" : "Refresh job log"}
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-[9px] text-violet-200/80 max-h-36 overflow-auto font-mono">
          {jobLogText ?? "…"}
        </pre>
      </div>
    </div>
  );
}
