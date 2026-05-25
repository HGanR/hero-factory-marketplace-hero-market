"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getFirstMissingField } from "@/lib/revenue-os/bentley-orchestrator";
import {
  BENTLEY_OPEN_CHAT_EVENT,
  BENTLEY_PIPELINE_PROGRESS_EVENT,
  BENTLEY_RESUME_PIPELINE_EVENT,
  BENTLEY_RESUME_PIPELINE_QUERY,
  pipelinePhaseLabel,
  type BentleyPipelineProgressDetail,
} from "@/lib/revenue-os/bentley-pipeline-progress";
import {
  BENTLEY_RUN_LOCK_EVENT,
  isRunLockHeld,
} from "@/lib/revenue-os/bentley-run-lock";
import {
  getFirstIncompleteWorkflowPhase,
  loadWorkflowState,
  subscribeBentleyWorkflowCrossTab,
  workflowShowsResumeablePartialRun,
  defaultWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { useAiRevenueOsBentleyActions, useAiRevenueOsSnapshotSignature } from "./AiRevenueOsSharedState";

function canResumeWorkflow(wf: BentleyWorkflowState): boolean {
  return workflowShowsResumeablePartialRun(wf);
}

/** Ambient strip: running, failed, or resumable — hide after clean completion with nothing to resume. */
function shouldShowAmbient(
  wf: BentleyWorkflowState,
  detail: BentleyPipelineProgressDetail | null,
  resumeEligible: boolean
): boolean {
  if (detail?.mode === "running" || detail?.mode === "failed") return true;
  if (wf.lastFailedPhase != null || coerceTrimmedString(wf.lastError)) return true;
  if (resumeEligible && canResumeWorkflow(wf)) return true;
  return false;
}

function formatAmbientHeadline(
  wf: BentleyWorkflowState,
  detail: BentleyPipelineProgressDetail | null,
  resumable: boolean
): string {
  if (detail?.mode === "running" && detail.activePhase) {
    return `Running: ${pipelinePhaseLabel(detail.activePhase)}…`;
  }
  if (detail?.mode === "failed" && detail.failedPhase) {
    const base = `Failed at ${pipelinePhaseLabel(detail.failedPhase)}`;
    return resumable ? `${base} · Resume` : base;
  }
  if (wf.lastFailedPhase) {
    const base = `Failed at ${pipelinePhaseLabel(wf.lastFailedPhase)}`;
    return resumable ? `${base} · Resume` : base;
  }
  if (coerceTrimmedString(wf.lastError)) {
    return resumable ? "Pipeline error · Resume" : "Pipeline error";
  }
  const next = getFirstIncompleteWorkflowPhase(wf);
  if (next && resumable) return `Next: ${pipelinePhaseLabel(next)}`;
  return "Resume pipeline";
}

const btnBase =
  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border";

type InnerProps = {
  variant: "page" | "dashboard";
  /** On /ai-revenue-os: false until intake is complete (matches Bentley chat resume rules). */
  resumeEligible: boolean;
};

function BentleyPipelineAmbientInner({ variant, resumeEligible }: InnerProps) {
  const router = useRouter();
  const [wf, setWf] = useState<BentleyWorkflowState>(defaultWorkflowState);
  const [detail, setDetail] = useState<BentleyPipelineProgressDetail | null>(null);
  const [lockHeld, setLockHeld] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const refresh = useCallback(() => setWf(loadWorkflowState()), []);

  useLayoutEffect(() => {
    refresh();
    setLockHeld(isRunLockHeld());
    setSessionReady(true);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const onProg = (e: Event) => {
      const ce = e as CustomEvent<BentleyPipelineProgressDetail>;
      if (ce.detail) setDetail(ce.detail);
      refresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onLock = () => setLockHeld(isRunLockHeld());
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProg);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(BENTLEY_RUN_LOCK_EVENT, onLock);
    const unsubCrossTab = subscribeBentleyWorkflowCrossTab(refresh);
    return () => {
      window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProg);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(BENTLEY_RUN_LOCK_EVENT, onLock);
      unsubCrossTab();
    };
  }, [refresh]);

  const resumable = resumeEligible && canResumeWorkflow(wf);
  const visible = useMemo(
    () => shouldShowAmbient(wf, detail, resumeEligible),
    [wf, detail, resumeEligible]
  );

  const resumeDisabled = detail?.mode === "running" || lockHeld;

  const line = formatAmbientHeadline(wf, detail, resumable);

  const openPage = () => {
    window.dispatchEvent(new CustomEvent(BENTLEY_OPEN_CHAT_EVENT));
  };
  const resumePage = () => {
    if (resumeDisabled) return;
    window.dispatchEvent(new CustomEvent(BENTLEY_RESUME_PIPELINE_EVENT));
  };

  const resumeDashboard = () => {
    if (resumeDisabled) return;
    const s = loadWorkflowState();
    const canResume = workflowShowsResumeablePartialRun(s);
    if (!canResume) {
      toast.info("Nothing to resume. Open Bentley on AI Revenue OS to start a new run.");
      return;
    }
    router.push(`/ai-revenue-os?${BENTLEY_RESUME_PIPELINE_QUERY}=1`);
  };

  if (!sessionReady || !visible) return null;

  const shell =
    variant === "page"
      ? "pointer-events-auto fixed top-20 right-4 z-40 w-[min(340px,calc(100vw-2rem))]"
      : "relative w-full max-w-full";

  const resumeBtnClass = `${btnBase} border-slate-600 bg-slate-800/80 text-slate-100 hover:bg-slate-700/90 disabled:opacity-45 disabled:pointer-events-none`;

  return (
    <div
      className={`${shell} rounded-xl border border-cyan-500/35 bg-slate-900/92 px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md`}
      role="status"
      aria-label="Bentley pipeline status"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-400/90">Bentley</p>
          <p className="text-xs text-slate-200 leading-snug mt-0.5">{line}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2.5">
        {variant === "page" ? (
          <>
            <button
              type="button"
              onClick={openPage}
              className={`${btnBase} border-cyan-500/45 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50`}
            >
              Open Bentley
            </button>
            {resumable ? (
              <button
                type="button"
                onClick={resumePage}
                disabled={resumeDisabled}
                className={resumeBtnClass}
              >
                Resume
              </button>
            ) : null}
          </>
        ) : (
          <>
            <Link
              href="/ai-revenue-os"
              className={`${btnBase} border-cyan-500/45 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50 inline-flex items-center justify-center`}
            >
              Open Bentley
            </Link>
            {resumable ? (
              <button type="button" onClick={resumeDashboard} disabled={resumeDisabled} className={resumeBtnClass}>
                Resume
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Must render inside `AiRevenueOsSharedStateProvider` (uses shared intake for Resume). */
export function BentleyPipelineAmbientStatusForAiRevenueOsPage() {
  useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const resumeEligible = getFirstMissingField(getBentleySnapshot()) === null;
  return <BentleyPipelineAmbientInner variant="page" resumeEligible={resumeEligible} />;
}

/** Revenue OS dashboard — Open navigates to AI Revenue OS; Resume uses guarded navigation. */
export function BentleyPipelineAmbientStatusForDashboard() {
  return <BentleyPipelineAmbientInner variant="dashboard" resumeEligible={true} />;
}
