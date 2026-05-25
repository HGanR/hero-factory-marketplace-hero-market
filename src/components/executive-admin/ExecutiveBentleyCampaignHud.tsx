"use client";

import { buildExecutiveBentleyHudState } from "@/lib/revenue-os/executive-bentley-hud";
import { assessExecutiveBentleyLaunchGovernance } from "@/lib/revenue-os/executive-bentley-launch-governance";
import { useExecutiveBentleyStageTracker } from "@/lib/revenue-os/executive-bentley-stage-tracker";
import { useAiRevenueOsBentleyActions, useAiRevenueOsSnapshotSignature } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { useExecutiveBentleyCampaign } from "./ExecutiveBentleyCampaignProvider";
import { ExecutiveBentleyWorkflowTimeline } from "./ExecutiveBentleyWorkflowTimeline";
import { ExecutiveBentleyIntakePanel } from "./ExecutiveBentleyIntakePanel";
import { ExecutiveBentleyCampaignOutput } from "./ExecutiveBentleyCampaignOutput";

type Props = {
  pendingApprovals?: number | null;
  content360Configured?: boolean;
};

export function ExecutiveBentleyCampaignHud({
  pendingApprovals,
  content360Configured,
}: Props) {
  const { pipelineBusy, runPipeline } = useExecutiveBentleyCampaign();
  useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const snap = getBentleySnapshot();
  const tracker = useExecutiveBentleyStageTracker(snap, {
    pendingApprovals,
    content360Configured,
  });
  const hud = buildExecutiveBentleyHudState(snap, {
    pendingApprovals,
    content360Configured,
    pipelineDetail: tracker.pipelineDetail,
  });
  const gov = assessExecutiveBentleyLaunchGovernance(snap, {
    pendingApprovals,
    content360Configured,
  });

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-[#00A3FF]/35 bg-gradient-to-br from-[#000814] via-[#001020] to-[#00050A] p-3 shadow-[inset_0_0_24px_rgba(0,163,255,0.08)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00A3FF] to-transparent opacity-60" />
        <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#00b7ff]/80">
          Bentley campaign command
        </div>
        <h3 className="mt-1 text-sm font-semibold text-white">{hud.headline}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{hud.subline}</p>
        {hud.industryLabel ? (
          <p className="mt-2 text-[10px] text-cyan-300/80">Industry · {hud.industryLabel}</p>
        ) : null}
      </div>

      <ExecutiveBentleyIntakePanel
        nextQuestion={hud.nextQuestion}
        intakeComplete={hud.intakeComplete}
        industryLabel={hud.industryLabel}
        businessName={hud.businessName}
        onRunPipeline={() => void runPipeline()}
        pipelineBusy={pipelineBusy}
      />

      <ExecutiveBentleyWorkflowTimeline
        stages={tracker.stages}
        progressPct={tracker.progressPct}
        compact
      />

      <ExecutiveBentleyCampaignOutput
        outputs={hud.outputs}
        launchGated={hud.launchGated}
        governanceLine={gov.nextGovernedAction}
      />
    </div>
  );
}
