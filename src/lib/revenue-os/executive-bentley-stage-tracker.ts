/**
 * Live stage tracker — subscribes to Bentley pipeline progress events for executive HUD.
 */

import { useEffect, useState } from "react";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  BENTLEY_PIPELINE_PROGRESS_EVENT,
  type BentleyPipelineProgressDetail,
} from "@/lib/revenue-os/bentley-pipeline-progress";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  buildExecutiveBentleyWorkflowStages,
  executiveBentleyCompletedStageCount,
  type ExecutiveBentleyStage,
} from "@/lib/revenue-os/executive-bentley-workflow-state";

export type ExecutiveBentleyStageTrackerState = {
  stages: ExecutiveBentleyStage[];
  completedCount: number;
  totalCount: number;
  progressPct: number;
  pipelineDetail: BentleyPipelineProgressDetail | null;
  statusLine: string;
};

export function deriveExecutiveBentleyStageTracker(
  snap: BentleySnapshot,
  pipelineDetail: BentleyPipelineProgressDetail | null,
  opts?: { pendingApprovals?: number | null; content360Configured?: boolean },
): ExecutiveBentleyStageTrackerState {
  const wf = loadWorkflowState();
  const stages = buildExecutiveBentleyWorkflowStages(snap, wf, {
    activePhase: pipelineDetail?.activePhase ?? null,
    pipelineMode: pipelineDetail?.mode ?? "idle",
    pendingApprovals: opts?.pendingApprovals,
    content360Configured: opts?.content360Configured,
  });
  const completedCount = executiveBentleyCompletedStageCount(stages);
  const totalCount = stages.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const statusLine =
    pipelineDetail?.statusLine?.trim() ||
    (completedCount === totalCount
      ? "Campaign workflow complete — review outputs and approval queue before launch."
      : `Stage ${completedCount + 1} of ${totalCount} — ${stages.find((s) => s.status === "active")?.label ?? "awaiting next step"}.`);

  return {
    stages,
    completedCount,
    totalCount,
    progressPct,
    pipelineDetail,
    statusLine,
  };
}

/** React hook for executive HUD — listens to real pipeline progress events. */
export function useExecutiveBentleyStageTracker(
  snap: BentleySnapshot,
  opts?: { pendingApprovals?: number | null; content360Configured?: boolean },
): ExecutiveBentleyStageTrackerState {
  const [pipelineDetail, setPipelineDetail] = useState<BentleyPipelineProgressDetail | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onProgress = (ev: Event) => {
      const d = (ev as CustomEvent<BentleyPipelineProgressDetail>).detail;
      if (d) setPipelineDetail(d);
    };
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProgress);
  }, []);

  return deriveExecutiveBentleyStageTracker(snap, pipelineDetail, opts);
}
