"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  getFirstIncompleteWorkflowPhase,
  loadWorkflowState,
  markPhaseComplete,
  saveWorkflowState,
  type BentleyWorkflowPhaseId,
} from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import {
  BENTLEY_LIFECYCLE_STAGE_ORDER,
  type BentleyLifecycleStageId,
  type BentleyLifecycleStageRecord,
} from "@/lib/revenue-os/bentley-lifecycle";
import { BentleyOperationalBlockerActions } from "@/components/revenue-os/BentleyOperationalBlockerActions";
import { useBentleyLaunchMismatchStatus } from "@/components/revenue-os/use-bentley-launch-mismatch-status";

function lifecycleLabel(id: BentleyLifecycleStageId): string {
  const m: Record<BentleyLifecycleStageId, string> = {
    pipeline_complete: "Pipeline",
    campaign_persisted: "DB campaign",
    launch_synced: "Post sync",
    launch_finalized: "Launch",
    analytics_ready: "Analytics",
    optimization_ready: "Opt. ready",
    optimization_executed: "Opt. executed",
  };
  return m[id] ?? id;
}

function phaseLabel(id: BentleyWorkflowPhaseId): string {
  const m: Record<BentleyWorkflowPhaseId, string> = {
    intake: "Intake",
    research: "Research",
    trends: "Trends & synthesis",
    content: "Viral content",
    campaign_notes: "Campaign notes",
    campaign_generation: "Campaign generation",
    media_brief: "Media brief",
    analysis: "Full analysis",
    dashboard: "Dashboard",
    launch_ready: "Launch",
  };
  return m[id] ?? id;
}

/**
 * Read-only workflow strip for /revenue-os/dashboard — Bentley pipeline resume context.
 * Orchestration continues on /ai-revenue-os; analysis completes with the main Run Analysis control.
 */
export function BentleyDashboardWorkflowPanel() {
  const {
    workflow: wf,
    lines: launchMismatchLines,
    loadingPosts: launchMismatchLoading,
    operationalBlockers,
    loadingOperational,
  } = useBentleyLaunchMismatchStatus();
  const campaignId = coerceTrimmedString(wf.artifacts.bentleyDbCampaignId) || undefined;

  useEffect(() => {
    const s = loadWorkflowState();
    if (s.completed.analysis && !s.completed.dashboard) {
      saveWorkflowState(markPhaseComplete(s, "dashboard", {}));
    }
  }, []);

  const next = getFirstIncompleteWorkflowPhase(wf);
  const err = coerceTrimmedString(wf.lastError);
  const lc = wf.lifecycle ?? {};
  const lifecycleRows = BENTLEY_LIFECYCLE_STAGE_ORDER.map((id) => {
    const r = lc[id] as BentleyLifecycleStageRecord | undefined;
    return r ? { id, r } : null;
  }).filter(Boolean) as { id: BentleyLifecycleStageId; r: BentleyLifecycleStageRecord }[];

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/35 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">Bentley pipeline</p>
      {operationalBlockers.length > 0 ? (
        <div
          className="mt-2 rounded-lg border border-slate-500/40 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
          role="status"
          aria-label="Production operational blockers"
        >
          <p className="font-semibold text-slate-100/95">External dependencies (OAuth, worker, analytics timing)</p>
          {loadingOperational ? (
            <p className="mt-1 text-[10px] text-slate-400">Loading operational readiness…</p>
          ) : null}
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {operationalBlockers.map((b) => (
              <li
                key={b.code}
                className={
                  b.severity === "waiting"
                    ? "break-words text-amber-100/90"
                    : "break-words text-rose-100/90"
                }
              >
                <span className="font-mono text-[10px] opacity-90">{b.code}</span>
                <span> — {b.detail}</span>
              </li>
            ))}
          </ul>
          <BentleyOperationalBlockerActions operationalBlockers={operationalBlockers} campaignId={campaignId} />
        </div>
      ) : null}
      {launchMismatchLines.length > 0 ? (
        <div
          className="mt-2 rounded-lg border border-amber-500/45 bg-amber-950/35 px-3 py-2 text-xs text-amber-100/95"
          role="status"
          aria-label="Launch sync health"
        >
          <p className="font-semibold text-amber-200/95">Launch sync — attention needed</p>
          {launchMismatchLoading && coerceTrimmedString(wf.artifacts.bentleyDbCampaignId) ? (
            <p className="mt-1 text-[10px] text-amber-200/75">Refreshing campaign post count…</p>
          ) : null}
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-amber-100/90">
            {launchMismatchLines.map((m) => (
              <li key={m.code}>
                <span className="font-medium">{m.title}</span>
                {m.detail ? <span className="text-amber-100/80"> — {m.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-1 text-slate-300">
        Current focus: <span className="font-medium text-white">{phaseLabel(wf.currentPhase)}</span>
        {next ? (
          <>
            {" "}
            · Next: <span className="text-cyan-100/95">{phaseLabel(next)}</span>
          </>
        ) : null}
      </p>
      {lifecycleRows.length > 0 ? (
        <div
          className="mt-2 rounded-lg border border-cyan-500/25 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300"
          role="status"
          aria-label="Full lifecycle stages"
        >
          <p className="font-semibold text-cyan-200/90">Full lifecycle (last run)</p>
          <ul className="mt-1.5 space-y-1">
            {lifecycleRows.map(({ id, r }) => (
              <li key={id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="text-slate-500">{lifecycleLabel(id)}</span>
                <span
                  className={
                    r.status === "ok"
                      ? "text-emerald-300/95"
                      : r.status === "blocked"
                        ? "text-rose-300/95"
                        : r.status === "waiting"
                          ? "text-amber-200/90"
                          : "text-slate-400"
                  }
                >
                  [{r.status}]
                </span>
                {r.detail ? <span className="text-slate-400 break-words">— {r.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {err ? (
        <p className="mt-1.5 text-xs text-amber-200/90 break-words" role="status">
          Last error: {err}
        </p>
      ) : null}
      {next && next !== "analysis" && next !== "dashboard" && next !== "launch_ready" ? (
        <p className="mt-2 text-xs text-slate-400">
          Continue automated steps on{" "}
          <Link href="/ai-revenue-os" className="text-cyan-400 underline hover:text-cyan-300">
            AI Revenue OS
          </Link>
          .
        </p>
      ) : null}
      {next === "analysis" ? (
        <p className="mt-2 text-xs text-slate-400">
          Run <strong className="text-slate-200">Full Analysis</strong> below to complete this step. Nothing auto-publishes.
        </p>
      ) : null}
      {next === "launch_ready" || wf.currentPhase === "launch_ready" ? (
        <p className="mt-2 text-xs text-slate-400">
          Review posting targets and OAuth, then use <strong className="text-slate-200">Launch</strong> when you are ready.
        </p>
      ) : null}
    </div>
  );
}
