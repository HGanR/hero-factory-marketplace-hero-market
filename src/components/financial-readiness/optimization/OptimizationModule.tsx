"use client";

import { useMemo } from "react";
import { ActionPanel } from "../ActionPanel";
import { FinancialReadinessWorkSurface } from "../FinancialReadinessWorkSurface";
import { ModuleCompletionPanel } from "../ModuleCompletionPanel";
import { useFinancialReadiness } from "../FinancialReadinessProvider";
import { buildCreditorVerificationLetter, buildDisputeLetter } from "../documentModels";
import { makeVaultDocument, OPTIMIZATION_STEPS, type OptimizationStepId } from "../state";
import { OptimizationCaseSelector } from "../CaseSelector";

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OptimizationModule() {
  const { state, dispatch } = useFinancialReadiness();
  const { stepIndex } = state.optimization;
  const step = OPTIMIZATION_STEPS[stepIndex] ?? OPTIMIZATION_STEPS[0];

  const letterPreview = useMemo(() => {
    const d = state.optimization.dispute;
    const m = state.optimization.disputeMeta;
    if (!d.creditor || !d.accountLast4)
      return "[Complete creditor name and last 4 digits to generate a draft letter.]";
    const { text } = buildDisputeLetter({
      consumerName: m.consumerName || "[Your name]",
      consumerAddress: m.consumerAddress || "[Your address]",
      creditor: d.creditor,
      accountLast4: d.accountLast4,
      reason: d.reason,
      details: d.details,
      bureau: m.bureau,
    });
    return text;
  }, [state.optimization.dispute, state.optimization.disputeMeta]);

  const creditorPreview = useMemo(() => {
    const d = state.optimization.dispute;
    const m = state.optimization.disputeMeta;
    const cv = state.optimization.creditorVerification;
    if (!d.creditor || !d.accountLast4)
      return "[Complete creditor and account to generate verification letter.]";
    const { text } = buildCreditorVerificationLetter({
      consumerName: m.consumerName || "[Your name]",
      consumerAddress: m.consumerAddress || "[Your address]",
      creditor: d.creditor,
      accountLast4: d.accountLast4,
      itemDescription: cv.itemDescription || "[Item description]",
      recordsRequested: cv.recordsRequested,
    });
    return text;
  }, [state.optimization.dispute, state.optimization.disputeMeta, state.optimization.creditorVerification]);

  const stepDone = (id: OptimizationStepId) => state.optimization.stepCompletion[id] ?? false;

  const stepFooter = (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-4">
      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={stepDone(step.id)}
          onChange={(e) =>
            dispatch({ type: "optimization/markStep", step: step.id, done: e.target.checked })
          }
          className="rounded border-white/20 bg-white/5"
        />
        Mark this step complete
      </label>
      {step.id === "timeline" && (
        <button
          type="button"
          onClick={() => dispatch({ type: "optimization/completeModule" })}
          className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
        >
          Mark optimization track complete
        </button>
      )}
    </div>
  );

  const saveDisputeDoc = () => {
    const d = state.optimization.dispute;
    const m = state.optimization.disputeMeta;
    const sources = {
      consumerName: m.consumerName || "[Your name]",
      consumerAddress: m.consumerAddress || "[Your address]",
      creditor: d.creditor,
      accountLast4: d.accountLast4,
      reason: d.reason,
      details: d.details,
      bureau: m.bureau,
    };
    const { text, sources: src } = buildDisputeLetter(sources);
    dispatch({ type: "optimization/setLetter", text });
    dispatch({
      type: "documents/add",
      doc: makeVaultDocument({
        type: "bureau_dispute",
        module: "optimization",
        text,
        sources: src,
        caseId: state.optimization.activeCaseId,
      }),
    });
  };

  const saveCreditorVerifyDoc = () => {
    const d = state.optimization.dispute;
    const m = state.optimization.disputeMeta;
    const cv = state.optimization.creditorVerification;
    const sources = {
      consumerName: m.consumerName || "[Your name]",
      consumerAddress: m.consumerAddress || "[Your address]",
      creditor: d.creditor,
      accountLast4: d.accountLast4,
      itemDescription: cv.itemDescription || "[Item description]",
      recordsRequested: cv.recordsRequested,
    };
    const { text, sources: src } = buildCreditorVerificationLetter(sources);
    dispatch({ type: "optimization/setLetter", text });
    dispatch({
      type: "documents/add",
      doc: makeVaultDocument({
        type: "creditor_verification",
        module: "optimization",
        text,
        sources: src,
        caseId: state.optimization.activeCaseId,
      }),
    });
  };

  const panel = (
    <ActionPanel title={step.label}>
      {step.id === "report" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Paste a short summary from your credit report. This persists locally and feeds advisor hints.
          </p>
          <textarea
            className="w-full min-h-[140px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Example: TransUnion 2/1 — Revolving accounts: 3; 1 late 30d in 2024 on Card …"
            value={state.optimization.reportNotes}
            onChange={(e) => dispatch({ type: "optimization/setReportNotes", text: e.target.value })}
          />
          {stepFooter}
        </div>
      )}

      {step.id === "negatives" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Select items to include in dispute prep.</p>
          {state.optimization.negativeItems.length === 0 ? (
            <p className="text-sm text-slate-500">
              No negative items yet. Add lines from your report in a future import, or proceed to dispute a
              specific account manually.
            </p>
          ) : (
            <ul className="space-y-2">
              {state.optimization.negativeItems.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    n.selected ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={n.selected}
                    onChange={() => dispatch({ type: "optimization/toggleNegative", id: n.id })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-white">{n.creditor}</div>
                    <div className="text-slate-400">
                      {n.amount} — {n.reason}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {stepFooter}
        </div>
      )}

      {step.id === "dispute" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Creditor name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={state.optimization.dispute.creditor}
                onChange={(e) =>
                  dispatch({ type: "optimization/setDispute", partial: { creditor: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500">
              Account last 4
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                maxLength={4}
                value={state.optimization.dispute.accountLast4}
                onChange={(e) =>
                  dispatch({
                    type: "optimization/setDispute",
                    partial: { accountLast4: e.target.value.replace(/\D/g, "").slice(0, 4) },
                  })
                }
              />
            </label>
          </div>
          <label className="text-xs text-slate-500 block">
            Dispute reason
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={state.optimization.dispute.reason}
              onChange={(e) =>
                dispatch({ type: "optimization/setDispute", partial: { reason: e.target.value } })
              }
            >
              <option value="inaccurate">Not mine / inaccurate</option>
              <option value="obsolete">Obsolete</option>
              <option value="duplicate">Duplicate</option>
              <option value="balance">Incorrect balance</option>
            </select>
          </label>
          <label className="text-xs text-slate-500 block">
            Details
            <textarea
              className="mt-1 w-full min-h-[100px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={state.optimization.dispute.details}
              onChange={(e) =>
                dispatch({ type: "optimization/setDispute", partial: { details: e.target.value } })
              }
            />
          </label>
          {stepFooter}
        </div>
      )}

      {step.id === "letter" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Fill identity fields once; they apply to both models. Generate saves structured text + sources to
            your document vault.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={state.optimization.disputeMeta.consumerName}
                onChange={(e) =>
                  dispatch({ type: "optimization/setDisputeMeta", partial: { consumerName: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your mailing address
              <textarea
                className="mt-1 w-full min-h-[64px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={state.optimization.disputeMeta.consumerAddress}
                onChange={(e) =>
                  dispatch({ type: "optimization/setDisputeMeta", partial: { consumerAddress: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Bureau (optional)
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="e.g. TransUnion"
                value={state.optimization.disputeMeta.bureau}
                onChange={(e) =>
                  dispatch({ type: "optimization/setDisputeMeta", partial: { bureau: e.target.value } })
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "optimization/setLetterTab", tab: "dispute" })}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                state.optimization.letterTab === "dispute"
                  ? "border-cyan-500/50 bg-cyan-500/15 text-white"
                  : "border-white/10 text-slate-400"
              }`}
            >
              Dispute letter
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "optimization/setLetterTab", tab: "creditor_verify" })}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                state.optimization.letterTab === "creditor_verify"
                  ? "border-cyan-500/50 bg-cyan-500/15 text-white"
                  : "border-white/10 text-slate-400"
              }`}
            >
              Creditor verification
            </button>
          </div>

          {state.optimization.letterTab === "dispute" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-100"
                  onClick={saveDisputeDoc}
                >
                  Generate & save dispute letter
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300"
                  onClick={() => dispatch({ type: "optimization/setLetter", text: "" })}
                >
                  Clear editor
                </button>
              </div>
              <textarea
                className="w-full min-h-[220px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-slate-200"
                value={state.optimization.letterText || letterPreview}
                onChange={(e) => dispatch({ type: "optimization/setLetter", text: e.target.value })}
              />
            </div>
          )}

          {state.optimization.letterTab === "creditor_verify" && (
            <div className="space-y-3">
              <label className="text-xs text-slate-500 block">
                Item to verify
                <textarea
                  className="mt-1 w-full min-h-[72px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={state.optimization.creditorVerification.itemDescription}
                  onChange={(e) =>
                    dispatch({
                      type: "optimization/setCreditorVerification",
                      partial: { itemDescription: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-xs text-slate-500 block">
                Records requested (optional detail)
                <textarea
                  className="mt-1 w-full min-h-[64px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  placeholder="e.g. Payment history, charge-off date, last statement"
                  value={state.optimization.creditorVerification.recordsRequested}
                  onChange={(e) =>
                    dispatch({
                      type: "optimization/setCreditorVerification",
                      partial: { recordsRequested: e.target.value },
                    })
                  }
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-100"
                  onClick={saveCreditorVerifyDoc}
                >
                  Generate & save verification letter
                </button>
              </div>
              <textarea
                className="w-full min-h-[220px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-slate-200"
                value={state.optimization.letterText || creditorPreview}
                onChange={(e) => dispatch({ type: "optimization/setLetter", text: e.target.value })}
              />
            </div>
          )}
          {stepFooter}
        </div>
      )}

      {step.id === "timeline" && (
        <div className="space-y-4">
          <label className="text-xs text-slate-500 block">
            Dispute sent / anchor date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={state.optimization.timelineAnchor}
              onChange={(e) => dispatch({ type: "optimization/setTimelineAnchor", iso: e.target.value })}
            />
          </label>
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            {[
              { label: "Investigation window (~30 days)", days: 30 },
              { label: "Extended / reinvestigation (~45 days)", days: 45 },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-slate-400">{row.label}</span>
                <span className="text-white font-mono">{addDays(state.optimization.timelineAnchor, row.days)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Dates are illustrative; actual timelines depend on consumer reporting agency processes and your
            jurisdiction.
          </p>
          {stepFooter}
        </div>
      )}
    </ActionPanel>
  );

  return (
    <>
      <FinancialReadinessWorkSurface
        systemName="Credit Optimization Engine"
        tagline="Dispute and repair workflows — validate negatives, draft letters, track timelines."
        steps={OPTIMIZATION_STEPS}
        stepIndex={stepIndex}
        onStep={(i) => dispatch({ type: "optimization/setStep", index: i })}
        sidebarTitle="Optimization workflow"
        advisorModule="optimization"
        panel={panel}
        headerActions={<OptimizationCaseSelector />}
      />
      {state.optimization.moduleCompleted && <ModuleCompletionPanel variant="optimization" />}
    </>
  );
}
