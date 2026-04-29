"use client";

import { useState } from "react";
import { ActionPanel } from "../ActionPanel";
import { FinancialReadinessWorkSurface } from "../FinancialReadinessWorkSurface";
import { ModuleCompletionPanel } from "../ModuleCompletionPanel";
import { useFinancialReadiness } from "../FinancialReadinessProvider";
import { buildCeaseCommunicationNotice, buildDebtValidationLetter } from "../documentModels";
import { makeVaultDocument, RESOLUTION_STEPS, type CaseStatus, type ResolutionStepId } from "../state";
import { ResolutionCaseSelector } from "../CaseSelector";

const FDCPA_BULLETS = [
  "Collectors cannot harass, oppress, or abuse you (including repetitive calls meant to annoy).",
  "They must identify themselves and state the debt is from a debt collector.",
  "Misrepresenting amounts, affiliation, or legal consequences is prohibited.",
  "You can request validation of the debt; keep copies of mailed requests.",
];

export function ResolutionModule() {
  const { state, dispatch } = useFinancialReadiness();
  const { stepIndex } = state.resolution;
  const step = RESOLUTION_STEPS[stepIndex] ?? RESOLUTION_STEPS[0];
  const [logDate, setLogDate] = useState("");
  const [logChannel, setLogChannel] = useState<"call" | "letter" | "email" | "other">("call");
  const [logCollector, setLogCollector] = useState("");
  const [logNotes, setLogNotes] = useState("");

  const stepDone = (id: ResolutionStepId) => state.resolution.stepCompletion[id] ?? false;

  const stepFooter = (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-4">
      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={stepDone(step.id)}
          onChange={(e) =>
            dispatch({ type: "resolution/markStep", step: step.id, done: e.target.checked })
          }
          className="rounded border-white/20 bg-white/5"
        />
        Mark this step complete
      </label>
      {step.id === "status" && (
        <button
          type="button"
          onClick={() => dispatch({ type: "resolution/completeModule" })}
          className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
        >
          Mark resolution track complete
        </button>
      )}
    </div>
  );

  const generateValidation = () => {
    const { text, sources } = buildDebtValidationLetter(state.resolution.validationSources);
    dispatch({ type: "resolution/setValidationBody", text });
    dispatch({
      type: "documents/add",
      doc: makeVaultDocument({
        type: "debt_validation",
        module: "resolution",
        text,
        sources,
        caseId: state.resolution.activeCaseId,
      }),
    });
  };

  const generateCease = () => {
    const { text, sources } = buildCeaseCommunicationNotice(state.resolution.ceaseSources);
    dispatch({ type: "resolution/setCeaseDraft", text });
    dispatch({
      type: "documents/add",
      doc: makeVaultDocument({
        type: "cease_communication",
        module: "resolution",
        text,
        sources,
        caseId: state.resolution.activeCaseId,
      }),
    });
  };

  const vs = state.resolution.validationSources;
  const cs = state.resolution.ceaseSources;

  const panel = (
    <ActionPanel title={step.label}>
      {step.id === "log" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Record every contact attempt. This is your contemporaneous record if you need to escalate.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Channel
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={logChannel}
                onChange={(e) => setLogChannel(e.target.value as typeof logChannel)}
              >
                <option value="call">Call</option>
                <option value="letter">Letter</option>
                <option value="email">Email</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Collector / agency
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Agency name"
                value={logCollector}
                onChange={(e) => setLogCollector(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Notes
              <textarea
                className="mt-1 w-full min-h-[80px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="What was said, threats, time of call..."
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-sm text-cyan-100"
            onClick={() => {
              if (!logDate || !logCollector.trim()) return;
              dispatch({
                type: "resolution/addInteraction",
                entry: {
                  caseId: state.resolution.activeCaseId,
                  date: logDate,
                  collector: logCollector.trim(),
                  channel: logChannel,
                  notes: logNotes,
                },
              });
              setLogNotes("");
            }}
          >
            Add entry
          </button>
          <ul className="space-y-2 max-h-48 overflow-auto">
            {state.resolution.interactions.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300"
              >
                <p className="text-white font-medium">
                  {e.date} · {e.channel}
                </p>
                <p className="text-slate-400">{e.collector}</p>
                <p className="text-xs text-slate-500 mt-1">{e.notes}</p>
              </li>
            ))}
            {state.resolution.interactions.length === 0 && (
              <li className="text-sm text-slate-500">No entries yet.</li>
            )}
          </ul>
          {stepFooter}
        </div>
      )}

      {step.id === "validation" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Structured debt validation model — edit before sending certified mail. Saving generates a vault
            entry with source fields.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={vs.consumerName}
                onChange={(e) =>
                  dispatch({ type: "resolution/setValidationSources", partial: { consumerName: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your address
              <textarea
                className="mt-1 w-full min-h-[64px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={vs.consumerAddress}
                onChange={(e) =>
                  dispatch({ type: "resolution/setValidationSources", partial: { consumerAddress: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Collector name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={vs.collectorName}
                onChange={(e) =>
                  dispatch({ type: "resolution/setValidationSources", partial: { collectorName: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500">
              Account / reference
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={vs.accountReference}
                onChange={(e) =>
                  dispatch({
                    type: "resolution/setValidationSources",
                    partial: { accountReference: e.target.value },
                  })
                }
              />
            </label>
            <label className="text-xs text-slate-500">
              Alleged amount
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={vs.allegedAmount}
                onChange={(e) =>
                  dispatch({ type: "resolution/setValidationSources", partial: { allegedAmount: e.target.value } })
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-100"
              onClick={generateValidation}
            >
              Generate & save to vault
            </button>
          </div>
          <textarea
            className="w-full min-h-[200px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-200"
            value={state.resolution.validationBody}
            onChange={(e) => dispatch({ type: "resolution/setValidationBody", text: e.target.value })}
          />
          {stepFooter}
        </div>
      )}

      {step.id === "cease" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Cease communication requests apply to third-party collectors under FDCPA. Know your rights before
            sending.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={cs.consumerName}
                onChange={(e) =>
                  dispatch({ type: "resolution/setCeaseSources", partial: { consumerName: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Your address
              <textarea
                className="mt-1 w-full min-h-[64px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={cs.consumerAddress}
                onChange={(e) =>
                  dispatch({ type: "resolution/setCeaseSources", partial: { consumerAddress: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Collector name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={cs.collectorName}
                onChange={(e) =>
                  dispatch({ type: "resolution/setCeaseSources", partial: { collectorName: e.target.value } })
                }
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Account / reference
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={cs.accountReference}
                onChange={(e) =>
                  dispatch({ type: "resolution/setCeaseSources", partial: { accountReference: e.target.value } })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-100"
            onClick={generateCease}
          >
            Generate & save to vault
          </button>
          <textarea
            className="w-full min-h-[180px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-200"
            value={state.resolution.ceaseDraft}
            onChange={(e) => dispatch({ type: "resolution/setCeaseDraft", text: e.target.value })}
          />
          {stepFooter}
        </div>
      )}

      {step.id === "fdcpa" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Educational summary only — not legal advice. Consult counsel for your situation.
          </p>
          <ul className="space-y-2">
            {FDCPA_BULLETS.map((b) => (
              <li key={b} className="text-sm text-slate-400">
                • {b}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={state.resolution.fdcpaHighlightsRead}
              onChange={(e) => dispatch({ type: "resolution/setFdcpaRead", read: e.target.checked })}
              className="rounded border-white/20 bg-white/5"
            />
            I’ve read the highlights and will seek professional advice if needed.
          </label>
          {stepFooter}
        </div>
      )}

      {step.id === "status" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Track where you are in the resolution workflow.</p>
          <div className="grid gap-2">
            {(
              [
                ["intake", "Intake — logging contacts"],
                ["validation_sent", "Validation letter sent"],
                ["cease_active", "Cease communication active"],
                ["resolved", "Resolved / closed loop"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                  state.resolution.caseStatus === value
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <input
                  type="radio"
                  name="case-status"
                  checked={state.resolution.caseStatus === value}
                  onChange={() => dispatch({ type: "resolution/setCaseStatus", status: value as CaseStatus })}
                />
                <span className="text-sm text-slate-200">{label}</span>
              </label>
            ))}
          </div>
          {stepFooter}
        </div>
      )}
    </ActionPanel>
  );

  return (
    <>
      <FinancialReadinessWorkSurface
        systemName="Debt Resolution Protocol"
        tagline="Active debt and collections — document, validate, and track your case progression."
        steps={RESOLUTION_STEPS}
        stepIndex={stepIndex}
        onStep={(i) => dispatch({ type: "resolution/setStep", index: i })}
        sidebarTitle="Resolution workflow"
        advisorModule="resolution"
        panel={panel}
        headerActions={<ResolutionCaseSelector />}
      />
      {state.resolution.moduleCompleted && <ModuleCompletionPanel variant="resolution" />}
    </>
  );
}
