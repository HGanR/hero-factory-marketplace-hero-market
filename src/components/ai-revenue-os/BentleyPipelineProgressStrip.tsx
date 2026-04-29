"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BENTLEY_OPEN_CHAT_EVENT,
  BENTLEY_PIPELINE_PROGRESS_EVENT,
  BENTLEY_RESUME_PIPELINE_EVENT,
  type BentleyPipelineProgressDetail,
} from "@/lib/revenue-os/bentley-pipeline-progress";
import {
  buildBentleyOperatorPipelineModel,
  deriveOperatorStageCompletionRaw,
  mergeOperatorCompletionMonotonic,
  type OperatorStageVisual,
} from "@/lib/revenue-os/bentley-operator-pipeline-model";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { useAiRevenueOsBentleyActions, useAiRevenueOsSnapshotSignature } from "./AiRevenueOsSharedState";

const VISUAL: Record<OperatorStageVisual, string> = {
  complete: "border-emerald-500/50 bg-emerald-950/40 text-emerald-100",
  current: "border-cyan-400/70 bg-cyan-950/45 text-cyan-50 ring-1 ring-cyan-400/30",
  next: "border-slate-400/60 bg-slate-900/60 text-slate-200",
  waiting: "border-slate-700/70 bg-slate-950/50 text-slate-500",
  blocked: "border-amber-500/55 bg-amber-950/45 text-amber-100",
};

export function BentleyPipelineProgressStrip() {
  const sig = useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();

  const [wfGen, setWfGen] = useState(0);
  const [detail, setDetail] = useState<BentleyPipelineProgressDetail | null>(null);
  const [latchedDone, setLatchedDone] = useState<boolean[]>(() => Array(7).fill(false));

  const wf = useMemo(() => loadWorkflowState(), [wfGen]);

  const bump = () => setWfGen((n) => n + 1);

  useEffect(() => {
    const snap = getBentleySnapshot();
    const w = loadWorkflowState();
    const raw = deriveOperatorStageCompletionRaw(snap, w);
    setLatchedDone((prev) => {
      const next = mergeOperatorCompletionMonotonic(prev, raw);
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getBentleySnapshot is not stable; sig bumps on snapshot updates
  }, [sig, wfGen]);

  useEffect(() => {
    bump();
    const onWf = () => bump();
    window.addEventListener("bentley-workflow-updated", onWf);
    const unsub = subscribeBentleyWorkflowCrossTab(bump);
    return () => {
      window.removeEventListener("bentley-workflow-updated", onWf);
      unsub();
    };
  }, []);

  useEffect(() => {
    const onEv = (e: Event) => {
      const ce = e as CustomEvent<BentleyPipelineProgressDetail>;
      if (ce.detail) {
        setDetail(ce.detail);
        bump();
      }
    };
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onEv);
    return () => window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onEv);
  }, []);

  const model = useMemo(() => {
    const snap = getBentleySnapshot();
    return buildBentleyOperatorPipelineModel({
      snapshot: snap,
      workflow: wf,
      progress: detail,
      completion: latchedDone,
    });
  }, [sig, wf, detail, latchedDone]);

  const openBentley = () => {
    window.dispatchEvent(new CustomEvent(BENTLEY_OPEN_CHAT_EVENT));
  };
  const resumePipeline = () => {
    window.dispatchEvent(new CustomEvent(BENTLEY_RESUME_PIPELINE_EVENT));
  };

  const cta = model.cta;

  return (
    <div
      className="rounded-xl border border-cyan-500/35 bg-slate-900/85 px-3 py-2 text-xs text-slate-200 shadow-md"
      aria-live="polite"
      aria-label="Bentley pipeline progress"
      data-testid="bentley-operator-pipeline-strip"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">Pipeline</span>
        {detail?.mode === "running" ? (
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1 mb-2" data-testid="bentley-operator-stage-pills">
        {model.stages.map((s) => (
          <span
            key={s.id}
            data-stage={s.id}
            data-visual={s.visual}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${VISUAL[s.visual]}`}
          >
            {s.label}
          </span>
        ))}
      </div>
      <div className="space-y-0.5 text-[11px] leading-snug border-t border-slate-700/50 pt-2">
        <p className="text-slate-200" data-testid="bentley-pipeline-current-line">
          {model.currentLine}
        </p>
        <p className="text-slate-400" data-testid="bentley-pipeline-next-line">
          {model.nextLine}
        </p>
      </div>
      <div className="mt-2.5">
        {cta.href ? (
          <Link
            href={cta.href}
            className="inline-flex w-full sm:w-auto justify-center rounded-lg bg-gradient-to-b from-cyan-500 to-cyan-700 px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95"
            data-testid="bentley-pipeline-dominant-cta"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (cta.dispatchOpenBentley) openBentley();
              else if (cta.dispatchResumePipeline) resumePipeline();
            }}
            className="w-full sm:w-auto rounded-lg bg-gradient-to-b from-cyan-500 to-cyan-700 px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95"
            data-testid="bentley-pipeline-dominant-cta"
          >
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}
