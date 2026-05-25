"use client";

import type { ExecutiveBentleyStage } from "@/lib/revenue-os/executive-bentley-workflow-state";

const STATUS_STYLES: Record<ExecutiveBentleyStage["status"], string> = {
  pending: "border-slate-700/60 bg-slate-950/40 text-slate-500",
  active: "border-[#00A3FF]/70 bg-[#001828]/80 text-cyan-100 shadow-[0_0_12px_rgba(0,163,255,0.25)]",
  complete: "border-emerald-500/40 bg-emerald-950/20 text-emerald-200",
  blocked: "border-amber-500/50 bg-amber-950/20 text-amber-100",
  failed: "border-red-500/50 bg-red-950/20 text-red-200",
};

const STATUS_DOT: Record<ExecutiveBentleyStage["status"], string> = {
  pending: "bg-slate-600",
  active: "bg-cyan-400 animate-pulse",
  complete: "bg-emerald-400",
  blocked: "bg-amber-400",
  failed: "bg-red-400",
};

type Props = {
  stages: ExecutiveBentleyStage[];
  progressPct: number;
  compact?: boolean;
};

export function ExecutiveBentleyWorkflowTimeline({ stages, progressPct, compact }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00b7ff]/70">
          Campaign pipeline
        </span>
        <span className="font-mono text-[10px] text-cyan-200/80">{progressPct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0066cc] via-[#00A3FF] to-[#7DF9FF] transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
      <div className={compact ? "grid grid-cols-2 gap-1.5" : "space-y-1.5 max-h-48 overflow-y-auto pr-1"}>
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${STATUS_STYLES[stage.status]}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[stage.status]}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-medium">{stage.label}</div>
              {stage.detail ? (
                <div className="truncate text-[9px] opacity-80">{stage.detail}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
