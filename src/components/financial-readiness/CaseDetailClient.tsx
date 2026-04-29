"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { statusLabel, vaultDocumentLabel } from "./vaultLabels";
import type { DocumentLifecycleStatus } from "./vaultTypes";
import { CaseTimeline } from "./CaseTimeline";
import { OperationalButtons } from "./OperationalButtons";
import { deriveCaseSignals } from "./deriveCaseSignals";
import {
  copyTextToClipboard,
  downloadTextFile,
  buildCaseSummaryText,
  buildAllDocumentsCombinedText,
} from "./exportUtils";
import { MatterBadgesRow, DocumentBadgesRow } from "./vaultBadges";
import { FollowUpPanel } from "./FollowUpPanel";
import { MATTER_NEXT_ACTION_TEMPLATES } from "./nextActionTemplates";

const STATUSES: DocumentLifecycleStatus[] = [
  "not_started",
  "in_progress",
  "awaiting_response",
  "follow_up_due",
  "completed",
  "escalated",
];

export function CaseDetailClient() {
  const params = useParams();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const { state, dispatch } = useFinancialReadiness();
  const c = useMemo(() => state.cases.find((x) => x.id === id), [state.cases, id]);
  const [nextActionEdit, setNextActionEdit] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const docs = useMemo(() => {
    const m = new Map<string, (typeof state.documents)[0]>();
    for (const d of state.documents) {
      if (d.caseId === id) m.set(d.id, d);
    }
    const row = state.cases.find((x) => x.id === id);
    if (row) {
      for (const did of row.documentIds) {
        const d = state.documents.find((x) => x.id === did);
        if (d) m.set(d.id, d);
      }
    }
    return [...m.values()];
  }, [state.documents, state.cases, id]);

  const logs = useMemo(
    () => state.resolution.interactions.filter((e) => e.caseId === id),
    [state.resolution.interactions, id]
  );

  const sig = useMemo(() => {
    if (!c) return null;
    return deriveCaseSignals(c, state.documents, today);
  }, [c, state.documents, today]);

  if (!id || !c || !sig) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-slate-400 mb-4">Matter not found.</p>
        <Link href="/financial-readiness/cases" className="text-cyan-400 hover:underline">
          ← All matters
        </Link>
      </div>
    );
  }

  const nextAction = nextActionEdit ?? c.nextAction;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap justify-between gap-2">
        <Link href="/financial-readiness/cases" className="text-sm text-cyan-300/90 hover:text-cyan-200">
          ← All matters
        </Link>
        <Link href="/financial-readiness" className="text-sm text-slate-500 hover:text-slate-300">
          Hub
        </Link>
      </div>

      <header className="border-b border-white/10 pb-4">
        <p className="text-xs uppercase text-slate-500">{c.module}</p>
        <h1 className="text-2xl font-bold text-white mt-1 flex flex-wrap items-center gap-2">
          {c.label}
          {sig.caseEscalated && (
            <span className="text-xs font-normal uppercase tracking-wide text-amber-300/90">Escalated</span>
          )}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Primary party: {c.primaryParty}</p>
        <div className="mt-2">
          <MatterBadgesRow status={c.status} tags={c.tags} />
        </div>
      </header>

      {sig.suggestCaseFollowUp && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-2">
          <span>At least one linked document is overdue — consider surfacing this matter as follow-up due.</span>
          <button
            type="button"
            className="rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs text-white hover:bg-rose-500/20"
            onClick={() =>
              dispatch({ type: "cases/patch", id: c.id, patch: { status: "follow_up_due" } })
            }
          >
            Set matter to follow-up due
          </button>
        </div>
      )}

      {sig.readinessToClose && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex flex-wrap items-center justify-between gap-2">
          <span>
            Ready to close: all linked letters are completed, no overdue follow-ups, and this matter is not escalated.
          </span>
          <button
            type="button"
            className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs text-white hover:bg-emerald-500/20"
            onClick={() => dispatch({ type: "operational/apply", target: "case", id: c.id, op: "resolved" })}
          >
            Mark matter completed
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 hover:border-cyan-500/35"
          onClick={async () => {
            await copyTextToClipboard(buildCaseSummaryText(c, docs, logs));
          }}
        >
          Copy matter summary
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 hover:border-cyan-500/35"
          onClick={() =>
            downloadTextFile(
              `matter-${c.id}-summary.txt`,
              buildCaseSummaryText(c, docs, logs)
            )
          }
        >
          Export matter summary
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 hover:border-cyan-500/35"
          onClick={() =>
            downloadTextFile(`matter-${c.id}-all-documents.txt`, buildAllDocumentsCombinedText(docs))
          }
          disabled={docs.length === 0}
        >
          Export all linked letters
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Operational actions</h2>
        <OperationalButtons target="case" id={c.id} dispatch={dispatch} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-xs text-slate-500">
          Matter status
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={c.status}
            onChange={(e) =>
              dispatch({
                type: "cases/patch",
                id: c.id,
                patch: { status: e.target.value as DocumentLifecycleStatus },
              })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FollowUpPanel
        variant="case"
        id={c.id}
        followUpDueAt={c.followUpDueAt}
        tags={c.tags}
        dispatch={dispatch}
        today={today}
      />

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Next action</h2>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Quick templates</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {MATTER_NEXT_ACTION_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-xs text-slate-300 hover:border-cyan-500/35"
              onClick={() => {
                dispatch({ type: "cases/patch", id: c.id, patch: { nextAction: t.text } });
                setNextActionEdit(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          className="w-full min-h-[80px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          value={nextAction}
          onChange={(e) => setNextActionEdit(e.target.value)}
          onBlur={() => {
            if (nextActionEdit !== null) {
              dispatch({ type: "cases/patch", id: c.id, patch: { nextAction: nextActionEdit } });
              setNextActionEdit(null);
            }
          }}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Documents</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/financial-readiness/documents/${encodeURIComponent(d.id)}`}
                  className={`block rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500/30 ${
                    sig.linkedDocsEscalatedByCase ? "border-l-4 border-amber-400/70 pl-2" : ""
                  }`}
                >
                  <span className="text-white">{vaultDocumentLabel(d.type)}</span>
                  <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
                    <DocumentBadgesRow status={d.status} tags={d.tags} />
                  </span>
                  {sig.linkedDocsEscalatedByCase && (
                    <span className="ml-2 text-[10px] uppercase text-amber-300/90">Escalated matter</span>
                  )}
                  {d.followUpDueAt && (
                    <span className="float-right text-xs font-mono text-amber-200/80">Due {d.followUpDueAt}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {logs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Collector log (this matter)</h2>
          <ul className="space-y-2">
            {logs.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <p className="text-white">
                  {e.date} · {e.channel}
                </p>
                <p className="text-slate-400">{e.collector}</p>
                <p className="text-xs text-slate-500 mt-1">{e.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Activity</h2>
        <CaseTimeline caseId={c.id} activities={state.activities} />
      </section>
    </div>
  );
}
