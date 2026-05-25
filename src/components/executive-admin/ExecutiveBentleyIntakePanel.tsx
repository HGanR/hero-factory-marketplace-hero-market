"use client";

type Props = {
  nextQuestion: string | null;
  intakeComplete: boolean;
  industryLabel: string;
  businessName: string;
  onRunPipeline?: () => void;
  pipelineBusy?: boolean;
};

export function ExecutiveBentleyIntakePanel({
  nextQuestion,
  intakeComplete,
  industryLabel,
  businessName,
  onRunPipeline,
  pipelineBusy,
}: Props) {
  return (
    <div className="rounded-xl border border-[#00A3FF]/20 bg-[#000814]/90 p-3 space-y-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00b7ff]/70">
        Skipper intake · real Bentley workflow
      </div>
      <div className="text-xs text-slate-200">
        {intakeComplete ? (
          <>
            <span className="text-emerald-300 font-medium">Intake complete</span>
            {businessName ? ` — ${businessName}` : null}
            {industryLabel ? ` · ${industryLabel}` : null}
          </>
        ) : (
          <>
            Collecting guided answers for{" "}
            <span className="text-cyan-200">{businessName !== "Campaign intake" ? businessName : "your campaign"}</span>
            {industryLabel ? ` (${industryLabel})` : ""}.
          </>
        )}
      </div>
      {!intakeComplete && nextQuestion ? (
        <p className="text-[11px] leading-relaxed text-cyan-100/90 border-l-2 border-cyan-500/50 pl-2">
          {nextQuestion}
        </p>
      ) : null}
      {intakeComplete && onRunPipeline ? (
        <button
          type="button"
          disabled={pipelineBusy}
          onClick={onRunPipeline}
          className="mt-1 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {pipelineBusy ? "Pipeline running…" : "Run Bentley pipeline"}
        </button>
      ) : null}
    </div>
  );
}
