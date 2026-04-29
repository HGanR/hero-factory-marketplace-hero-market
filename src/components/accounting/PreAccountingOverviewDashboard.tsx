"use client";

import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { useAccountingPreAccounting } from "./AccountingPreAccountingContext";
import type { FilerEntityType, QuarterlyId } from "@/lib/accounting/pre-accounting/types";
import { computeAccountingReadiness } from "@/lib/accounting/pre-accounting/compute-readiness";
import { readTransactionSnapshotFromLocalStorage } from "@/lib/accounting/pre-accounting/profile-storage";
import { savePreAccountingWorkspace } from "@/lib/accounting/pre-accounting/api-client";

const ENTITY_OPTIONS: { value: FilerEntityType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "sole_prop_schedule_c", label: "Sole proprietor / Schedule C" },
  { value: "single_member_llc", label: "Single-member LLC" },
  { value: "partnership", label: "Partnership" },
  { value: "s_corp", label: "S corporation" },
  { value: "c_corp", label: "C corporation" },
  { value: "trust_estate", label: "Trust / estate" },
  { value: "nonprofit", label: "Nonprofit (if applicable)" },
];

export function PreAccountingOverviewDashboard() {
  const { profile, patchProfile, serverWorkspace, reloadFromServer, lastServerError } = useAccountingPreAccounting();
  const [ledgerSnap, setLedgerSnap] = useState(() => readTransactionSnapshotFromLocalStorage());

  useEffect(() => {
    const refresh = () => setLedgerSnap(readTransactionSnapshotFromLocalStorage());
    window.addEventListener("focus", refresh);
    window.addEventListener("accounting-storage-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, 8000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("accounting-storage-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(id);
    };
  }, []);

  const readiness = useMemo(
    () => computeAccountingReadiness(profile, ledgerSnap),
    [profile, ledgerSnap]
  );

  const serverSnap = serverWorkspace?.readinessSnapshot as
    | {
        bookkeepingScore?: number;
        handoffPercent?: number;
        unresolvedItemsCount?: number;
        computedAt?: string | Date;
      }
    | null
    | undefined;

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  }, []);

  const readinessGate = serverWorkspace?.readinessGate as
    | { passed?: boolean; blockers?: string[]; warnings?: string[] }
    | null
    | undefined;
  const completeness = serverWorkspace?.completenessSnapshot as
    | { handoff?: { percent?: number; label?: string; notes?: string[] } }
    | null
    | undefined;

  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideErr, setOverrideErr] = useState<string | null>(null);

  const saveWithOverride = async () => {
    const note = overrideNote.trim();
    if (!note) return;
    setOverrideBusy(true);
    setOverrideErr(null);
    try {
      const ledger = readTransactionSnapshotFromLocalStorage();
      const res = await savePreAccountingWorkspace(profile, ledger, { handoffReadinessOverrideNote: note });
      if (res?.ok) {
        await reloadFromServer();
        setOverrideNote("");
      } else {
        setOverrideErr((res as { error?: string } | null)?.error ?? "Save failed");
      }
    } finally {
      setOverrideBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-slate-400">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">Internal reviewer (not client-facing)</p>
        <label className="mt-2 block space-y-1">
          <span className="text-slate-300">Internal review notes</span>
          <textarea
            value={profile.internalReviewNotes ?? ""}
            onChange={(e) => patchProfile({ internalReviewNotes: e.target.value })}
            className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Team-only: issues, scope, risk flags — excluded from client exports unless handoff explicitly includes internal notes."
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
        <span className="font-medium text-slate-300">Review workflow</span>
        <select
          className="ml-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
          value={profile.reviewStatus ?? "draft"}
          onChange={(e) => patchProfile({ reviewStatus: e.target.value })}
        >
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="ready_for_preparer">Ready for preparer</option>
          <option value="needs_followup">Needs follow-up</option>
          <option value="finalized_for_handoff">Finalized for handoff</option>
        </select>
        {serverSnap?.computedAt ? (
          <span className="ml-3 text-xs text-slate-500">
            Server readiness snapshot: {new Date(serverSnap.computedAt).toLocaleString()}
          </span>
        ) : null}
        {readinessGate && !readinessGate.passed ? (
          <div className="mt-3 rounded border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
            <p className="font-semibold text-amber-200">Handoff readiness gate</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {(readinessGate.blockers ?? []).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {(readinessGate.warnings ?? []).length ? (
              <p className="mt-2 text-amber-200/80">Warnings: {(readinessGate.warnings ?? []).join(" · ")}</p>
            ) : null}
            <p className="mt-2 text-slate-400">
              Elevating to <strong>Ready for preparer</strong> or <strong>Finalized for handoff</strong> requires resolving
              blockers or a reviewer acknowledgement below.
            </p>
          </div>
        ) : null}
        {lastServerError ? (
          <p className="mt-2 text-xs text-red-300/90" role="alert">
            {lastServerError}
          </p>
        ) : null}
        {profile.handoffReadinessOverrideNote ? (
          <p className="mt-2 text-xs text-slate-500">
            Prior override on file
            {profile.handoffReadinessOverrideAt
              ? ` (${new Date(profile.handoffReadinessOverrideAt).toLocaleString()})`
              : ""}
            .
          </p>
        ) : null}
        <div className="mt-3 space-y-1">
          <label className="block text-xs text-slate-500">Reviewer acknowledgement (only if gate blockers remain)</label>
          <textarea
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            className="min-h-[56px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            placeholder="Explain why the file may proceed despite open items (preparatory — not tax advice)."
          />
          {overrideErr ? <p className="text-xs text-red-300">{overrideErr}</p> : null}
          <button
            type="button"
            disabled={overrideBusy || !overrideNote.trim()}
            onClick={() => void saveWithOverride()}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            {overrideBusy ? "Saving…" : "Save with acknowledgement"}
          </button>
        </div>
      </div>

      {completeness?.handoff ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
          <span className="font-medium text-slate-300">Packet evidence completeness (server)</span>
          <p className="mt-1 text-slate-300">
            {completeness.handoff.label?.replace(/_/g, " ")} · {completeness.handoff.percent ?? 0}%
          </p>
          {(completeness.handoff.notes ?? []).length ? (
            <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
              {(completeness.handoff.notes ?? []).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Tax year</span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={profile.taxYear}
            onChange={(e) => patchProfile({ taxYear: Number(e.target.value) })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Filer / entity type (for preparer discussion)</span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={profile.filerEntityType}
            onChange={(e) => patchProfile({ filerEntityType: e.target.value as FilerEntityType })}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookkeeping completeness</p>
          <p className="mt-2 text-3xl font-bold text-cyan-400">{readiness.bookkeepingCompletenessScore}%</p>
          <Progress value={readiness.bookkeepingCompletenessScore} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-slate-500">
            Heuristic (local).
            {serverSnap?.bookkeepingScore != null
              ? ` Server last sync: ${serverSnap.bookkeepingScore}%.`
              : " Your preparer validates books."}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated handoff readiness</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">{readiness.handoffReadinessPercent}%</p>
          <Progress value={readiness.handoffReadinessPercent} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-slate-500">
            Local + ledger.{" "}
            {serverSnap?.handoffPercent != null ? `Server: ${serverSnap.handoffPercent}%.` : "Sync saves server snapshot."}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unresolved ledger items (heuristic)</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{readiness.unresolvedLedgerItems}</p>
          <p className="mt-2 text-xs text-slate-500">
            Transactions loosely flagged uncategorized — refine in Ledger.
            {serverSnap?.unresolvedItemsCount != null ? ` Server count: ${serverSnap.unresolvedItemsCount}.` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Quarterly readiness</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(["Q1", "Q2", "Q3", "Q4"] as QuarterlyId[]).map((q) => (
              <li key={q} className="flex justify-between gap-2">
                <span className="text-slate-400">{q}</span>
                <span
                  className={
                    readiness.quarterlyReadiness[q] === "ready"
                      ? "text-emerald-400"
                      : readiness.quarterlyReadiness[q] === "in_progress"
                        ? "text-amber-300"
                        : "text-slate-500"
                  }
                >
                  {readiness.quarterlyReadiness[q].replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Year-end readiness</h3>
          <p className="mt-2 text-lg capitalize text-slate-300">{readiness.yearEndReadiness.replace("_", " ")}</p>
          <p className="mt-2 text-xs text-slate-500">
            Year-end packaging should be reviewed with your licensed tax professional before filing.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Missing documents checklist (common gaps)</h3>
        {readiness.missingDocumentsChecklist.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-200/90">
            Core tags are marked collected — your preparer may still request additional items.
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
            {readiness.missingDocumentsChecklist.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
