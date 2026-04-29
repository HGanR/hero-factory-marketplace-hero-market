"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccountingPreAccounting } from "./AccountingPreAccountingContext";
import { computeTaxFormCandidates } from "@/lib/accounting/pre-accounting/tax-form-candidates";
import { readTransactionSnapshotFromLocalStorage } from "@/lib/accounting/pre-accounting/profile-storage";
import type { FormReadinessStatus } from "@/lib/accounting/pre-accounting/types";
import { patchFormCandidate } from "@/lib/accounting/pre-accounting/api-client";
import { LEDGER_CROSSWALK } from "@/lib/accounting/pre-accounting/ledger-crosswalk";

function statusLabel(s: FormReadinessStatus): string {
  switch (s) {
    case "ready":
      return "Ready (heuristic)";
    case "partial":
      return "Partial";
    case "missing_support":
      return "Missing support";
    case "needs_professional_review":
      return "Needs professional review";
    default:
      return s;
  }
}

function coerceServerFormStatus(s: string | undefined): FormReadinessStatus {
  if (s === "ready" || s === "partial" || s === "missing_support" || s === "needs_professional_review") return s;
  return "needs_professional_review";
}

function statusClass(s: FormReadinessStatus): string {
  switch (s) {
    case "ready":
      return "text-emerald-400";
    case "partial":
      return "text-amber-300";
    case "missing_support":
      return "text-red-400/90";
    case "needs_professional_review":
      return "text-cyan-300";
    default:
      return "text-slate-400";
  }
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonNumberArray(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

type ServerFormRow = {
  id: number;
  formCode: string;
  displayName: string;
  rationale?: string | null;
  status?: string;
  requiredRecordsJson?: string | null;
  attachedDocumentIdsJson?: string | null;
  missingSupportJson?: string | null;
  reviewerStatus?: string;
  reviewerNotes?: string | null;
  supportNeededJson?: string | null;
  supportGapStatus?: string;
  supportGapNote?: string | null;
};

const REVIEWER_STATUS = ["pending_review", "supporting_attached", "needs_followup", "cleared"] as const;
const GAP_STATUS = ["open", "still_missing", "resolved", "waived"] as const;

export function TaxFormCandidatesPanel() {
  const { profile, serverWorkspace, reloadFromServer } = useAccountingPreAccounting();
  const [snap, setSnap] = useState(() => readTransactionSnapshotFromLocalStorage());

  useEffect(() => {
    const r = () => setSnap(readTransactionSnapshotFromLocalStorage());
    window.addEventListener("focus", r);
    return () => window.removeEventListener("focus", r);
  }, []);

  const forms = useMemo(() => computeTaxFormCandidates(profile, snap), [profile, snap]);

  const serverRows = useMemo(() => {
    const raw = serverWorkspace?.formCandidates;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw as ServerFormRow[];
  }, [serverWorkspace?.formCandidates]);

  const completenessByForm = useMemo(() => {
    const snap = serverWorkspace?.completenessSnapshot as { forms?: Record<string, { percent: number; label: string }> } | null;
    return snap?.forms ?? {};
  }, [serverWorkspace?.completenessSnapshot]);

  const onReviewerChange = async (id: number, reviewerStatus: string, reviewerNotes?: string) => {
    await patchFormCandidate(
      id,
      reviewerNotes !== undefined ? { reviewerStatus, reviewerNotes } : { reviewerStatus }
    );
    await reloadFromServer();
  };

  const onGapChange = async (
    id: number,
    patch: { supportGapStatus?: string; supportGapNote?: string | null; attachedDocumentIdsJson?: number[] | null }
  ) => {
    await patchFormCandidate(id, patch);
    await reloadFromServer();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        <strong className="text-slate-200">Form support matrix</strong> — probable forms with required/supporting records,
        attached document ids (server-linked), missing support heuristics, and reviewer status. Not a filing determination.
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Ledger crosswalk (reference)</h3>
        <ul className="mt-2 space-y-2 text-xs text-slate-400">
          {LEDGER_CROSSWALK.map((row) => (
            <li key={row.id}>
              <span className="text-slate-300">{row.label}</span> → {row.probableFormCodes.join(", ")} ·{" "}
              {row.commonSupportDocuments.slice(0, 2).join(", ")}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Form</th>
              <th className="px-3 py-2">Rationale</th>
              <th className="px-3 py-2">Required / support</th>
              <th className="px-3 py-2">Attached doc ids</th>
              <th className="px-3 py-2">Missing</th>
              <th className="px-3 py-2">Evidence</th>
              <th className="px-3 py-2">Heuristic</th>
              <th className="px-3 py-2">Gap / attach</th>
              <th className="px-3 py-2">Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {serverRows
              ? serverRows.map((r) => {
                  const st = coerceServerFormStatus(r.status);
                  const req = parseJsonStringArray(r.requiredRecordsJson);
                  const attached = parseJsonNumberArray(r.attachedDocumentIdsJson);
                  const missing = parseJsonStringArray(r.missingSupportJson);
                  const ev = completenessByForm[r.formCode];
                  return (
                    <tr key={r.id} className="border-b border-slate-800/80 align-top">
                      <td className="px-3 py-2 font-medium text-slate-200">
                        {r.displayName}
                        <div className="text-xs font-normal text-slate-500">{r.formCode}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.rationale ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{req.length ? req.join("; ") : "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-cyan-200/90">
                        <input
                          className="w-full rounded border border-slate-800 bg-slate-950 px-1 py-0.5 font-mono text-xs"
                          defaultValue={attached.join(", ")}
                          placeholder="doc ids"
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const ids = raw
                              ? raw
                                  .split(/[,\s]+/)
                                  .map((x) => Number(x))
                                  .filter((n) => Number.isFinite(n))
                              : [];
                            void onGapChange(r.id, { attachedDocumentIdsJson: ids.length ? ids : null });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-amber-200/90">{missing.length ? missing.join("; ") : "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {ev ? `${ev.label.replace(/_/g, " ")} (${ev.percent}%)` : "—"}
                      </td>
                      <td className={`px-3 py-2 text-xs font-medium ${statusClass(st)}`}>{statusLabel(st)}</td>
                      <td className="px-3 py-2 space-y-1">
                        <select
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                          value={r.supportGapStatus ?? "open"}
                          onChange={(e) => void onGapChange(r.id, { supportGapStatus: e.target.value })}
                        >
                          {GAP_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <textarea
                          defaultValue={r.supportGapNote ?? ""}
                          placeholder="Support gap note / waiver"
                          className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                          rows={2}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (r.supportGapNote ?? "")) void onGapChange(r.id, { supportGapNote: v || null });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                          value={r.reviewerStatus ?? "pending_review"}
                          onChange={(e) => void onReviewerChange(r.id, e.target.value)}
                        >
                          {REVIEWER_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <textarea
                          defaultValue={r.reviewerNotes ?? ""}
                          placeholder="Reviewer notes"
                          className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                          rows={2}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (r.reviewerNotes ?? "")) void onReviewerChange(r.id, r.reviewerStatus ?? "pending_review", v);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              : forms.map((f) => (
                  <tr key={f.id} className="border-b border-slate-800/80 align-top">
                    <td className="px-3 py-2 font-medium text-slate-200">{f.name}</td>
                    <td className="px-3 py-2 text-slate-400">{f.whyMayApply}</td>
                    <td className="px-3 py-2 text-slate-400">{f.usualRecords}</td>
                    <td className="px-3 py-2 text-slate-500">—</td>
                    <td className="px-3 py-2 text-slate-500">—</td>
                    <td className={`px-3 py-2 text-xs font-medium ${statusClass(f.status)}`}>{statusLabel(f.status)}</td>
                    <td className="px-3 py-2 text-slate-600">—</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!serverRows && forms.length === 0 ? (
        <p className="text-sm text-slate-500">Select entity type and add ledger activity to surface candidates.</p>
      ) : null}
    </div>
  );
}
