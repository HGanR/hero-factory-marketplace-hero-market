"use client";

import { useMemo } from "react";
import { ActionPanel } from "../ActionPanel";
import { FinancialReadinessWorkSurface } from "../FinancialReadinessWorkSurface";
import { ModuleCompletionPanel } from "../ModuleCompletionPanel";
import { useFinancialReadiness } from "../FinancialReadinessProvider";
import { FOUNDATION_STEPS, type FoundationStepId } from "../state";

export function FoundationModule() {
  const { state, dispatch } = useFinancialReadiness();
  const { stepIndex } = state.foundation;
  const step = FOUNDATION_STEPS[stepIndex] ?? FOUNDATION_STEPS[0];

  const utilizationPct = useMemo(() => {
    const { balance, limit } = state.foundation.utilization;
    if (limit <= 0) return 0;
    return Math.min(100, (balance / limit) * 100);
  }, [state.foundation.utilization]);

  const stepDone = (id: FoundationStepId) => state.foundation.stepCompletion[id] ?? false;

  const stepFooter = (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-4">
      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={stepDone(step.id)}
          onChange={(e) =>
            dispatch({ type: "foundation/markStep", step: step.id, done: e.target.checked })
          }
          className="rounded border-white/20 bg-white/5"
        />
        Mark this step complete
      </label>
      {step.id === "next" && (
        <button
          type="button"
          onClick={() => dispatch({ type: "foundation/completeModule" })}
          className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
        >
          Mark foundation track complete
        </button>
      )}
    </div>
  );

  const panel = (
    <ActionPanel title={step.label}>
      {step.id === "basics" && (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Credit scores summarize how reliably you repay borrowed money. The most influential factors are
            payment history and revolving utilization (balance vs. limit).
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>Pay at least the minimum on time — late payments hurt the most.</li>
            <li>Keep reported balances low before the statement cuts (often under 30% of limit).</li>
            <li>Age of accounts and mix of credit types matter, but less than pay history.</li>
          </ul>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.foundation.basicsAcknowledged}
              onChange={(e) => dispatch({ type: "foundation/setBasics", acknowledged: e.target.checked })}
              className="rounded border-white/20 bg-white/5"
            />
            <span>I’ve reviewed the basics and I’m ready to measure utilization.</span>
          </label>
          {stepFooter}
        </div>
      )}

      {step.id === "utilization" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Enter your revolving balance and limit (one card or aggregate). This is a planning calculator, not a
            bureau report.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-xs text-slate-500 mb-1">
              Balance ($)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={state.foundation.utilization.balance || ""}
                onChange={(e) =>
                  dispatch({
                    type: "foundation/setUtilization",
                    balance: Number(e.target.value) || 0,
                    limit: state.foundation.utilization.limit,
                  })
                }
              />
            </label>
            <label className="block text-xs text-slate-500 mb-1">
              Limit ($)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={state.foundation.utilization.limit || ""}
                onChange={(e) =>
                  dispatch({
                    type: "foundation/setUtilization",
                    balance: state.foundation.utilization.balance,
                    limit: Number(e.target.value) || 1,
                  })
                }
              />
            </label>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-xs uppercase text-cyan-200/80 mb-2">Estimated utilization</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{utilizationPct.toFixed(1)}%</span>
              <span className="text-sm text-slate-400 mb-1">of limit</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  utilizationPct > 30 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
          </div>
          {stepFooter}
        </div>
      )}

      {step.id === "checklist" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Check off habits that you already follow or plan to implement this quarter.
          </p>
          <div className="space-y-2">
            {(
              [
                ["secured-card", "Secured or starter card on file"],
                ["autopay", "Autopay enabled for minimums"],
                ["low-utilization", "Balances paid before statement date"],
                ["diverse-credit", "Healthy mix (installment + revolving)"],
                ["monitor-reports", "Monitoring soft pulls / alerts"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 cursor-pointer hover:border-cyan-500/30"
              >
                <input
                  type="checkbox"
                  checked={!!state.foundation.checklist[key]}
                  onChange={() => dispatch({ type: "foundation/toggleChecklist", key })}
                  className="mt-1 rounded border-white/20 bg-white/5"
                />
                <span className="text-sm text-slate-200">{label}</span>
              </label>
            ))}
          </div>
          {stepFooter}
        </div>
      )}

      {step.id === "next" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Based on your inputs, capture a short “next step” so you can track it alongside other platform
            modules (Accounting, Trust Records) later.
          </p>
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            placeholder="e.g. Pay $200 before Jan 12 statement date on Card …"
            value={state.foundation.nextHint}
            onChange={(e) => dispatch({ type: "foundation/setNextHint", text: e.target.value })}
          />
          <p className="text-xs text-slate-500">
            Tip: export this note to your calendar or Accounting workspace when integrations go live.
          </p>
          {stepFooter}
        </div>
      )}
    </ActionPanel>
  );

  return (
    <>
      <FinancialReadinessWorkSurface
        systemName="Credit Foundation System"
        tagline="Education and setup — build habits before you optimize or resolve."
        steps={FOUNDATION_STEPS}
        stepIndex={stepIndex}
        onStep={(i) => dispatch({ type: "foundation/setStep", index: i })}
        sidebarTitle="Foundation workflow"
        advisorModule="foundation"
        panel={panel}
      />
      {state.foundation.moduleCompleted && <ModuleCompletionPanel variant="foundation" />}
    </>
  );
}
