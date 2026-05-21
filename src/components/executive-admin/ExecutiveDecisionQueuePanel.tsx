"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type {
  ExecutiveOperationalDecisionDto,
  ExecutivePendingDecisionsDto,
} from "@/lib/executive-agent/executive-operational-decisions";

type Props = {
  subjectId: ExecutiveSubjectId;
  clientId: string;
  orderId: string;
  threadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onDecisionRecorded?: () => void;
};

export function ExecutiveDecisionQueuePanel({
  subjectId,
  clientId,
  orderId,
  threadId,
  onSelectThread,
  onDecisionRecorded,
}: Props) {
  const [bundle, setBundle] = useState<ExecutivePendingDecisionsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [deferReason, setDeferReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskCountByDecision, setTaskCountByDecision] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ subjectId, promote: "true" });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (orderId.trim()) params.set("orderId", orderId.trim());
      if (threadId?.trim()) params.set("threadId", threadId.trim());
      const r = await fetch(`/api/admin/executive-agent/decisions?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutivePendingDecisionsDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Load failed (${r.status})`);
        setBundle(null);
        return;
      }
      setBundle(j);

      const tParams = new URLSearchParams({ subjectId });
      if (clientId.trim()) tParams.set("clientId", clientId.trim());
      if (orderId.trim()) tParams.set("orderId", orderId.trim());
      if (threadId?.trim()) tParams.set("threadId", threadId.trim());
      const tr = await fetch(`/api/admin/executive-agent/tasks?${tParams}`, {
        credentials: "include",
        cache: "no-store",
      });
      const tj = (await tr.json().catch(() => ({}))) as {
        open?: Array<{ decisionId: string | null }>;
        inProgress?: Array<{ decisionId: string | null }>;
        blocked?: Array<{ decisionId: string | null }>;
      };
      const counts: Record<string, number> = {};
      for (const bucket of [tj.open, tj.inProgress, tj.blocked]) {
        for (const t of bucket ?? []) {
          if (t.decisionId) counts[t.decisionId] = (counts[t.decisionId] ?? 0) + 1;
        }
      }
      setTaskCountByDecision(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [subjectId, clientId, orderId, threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string) => {
    if (!decisionDraft.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/executive-agent/decisions/${id}/decide`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionText: decisionDraft.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Decide failed (${r.status})`);
        return;
      }
      setDecisionDraft("");
      setActiveId(null);
      onDecisionRecorded?.();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const defer = async (id: string) => {
    if (!deferUntil.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/executive-agent/decisions/${id}/defer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deferredUntil: new Date(deferUntil).toISOString(),
          deferReason: deferReason.trim() || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Defer failed (${r.status})`);
        return;
      }
      setDeferUntil("");
      setDeferReason("");
      setActiveId(null);
      onDecisionRecorded?.();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (d: ExecutiveOperationalDecisionDto) => (
    <li
      key={d.id}
      className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-2 text-xs text-slate-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-amber-100/95">{d.title}</div>
          <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">{d.promptSummary}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase text-slate-500">
            <span>{d.status}</span>
            <span>{d.priority}</span>
            {d.department ? <span>{d.department}</span> : null}
            {d.sourceKind ? <span>{d.sourceKind}</span> : null}
            {(taskCountByDecision[d.id] ?? 0) > 0 ? (
              <span className="rounded border border-cyan-500/40 px-1 text-cyan-200">
                {taskCountByDecision[d.id]} task
              </span>
            ) : null}
          </div>
        </div>
        {d.threadId && onSelectThread ? (
          <button
            type="button"
            onClick={() => onSelectThread(d.threadId!)}
            className="text-[9px] uppercase text-cyan-400/90 hover:text-cyan-300"
          >
            Open thread
          </button>
        ) : null}
      </div>
      {activeId === d.id ? (
        <div className="mt-2 space-y-2 border-t border-amber-500/20 pt-2">
          <textarea
            value={decisionDraft}
            onChange={(e) => setDecisionDraft(e.target.value)}
            rows={2}
            placeholder="Owner decision (human-authored only)"
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !decisionDraft.trim()}
              onClick={() => void decide(d.id)}
              className="rounded-full border border-emerald-500/40 px-2.5 py-1 text-[9px] font-semibold uppercase text-emerald-200 disabled:opacity-40"
            >
              Record decision
            </button>
            <input
              type="date"
              value={deferUntil}
              onChange={(e) => setDeferUntil(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px]"
            />
            <input
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              placeholder="Defer reason"
              className="min-w-[120px] flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px]"
            />
            <button
              type="button"
              disabled={busy || !deferUntil}
              onClick={() => void defer(d.id)}
              className="rounded-full border border-slate-500/40 px-2.5 py-1 text-[9px] uppercase text-slate-300 disabled:opacity-40"
            >
              Defer
            </button>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="text-[9px] uppercase text-slate-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setActiveId(d.id)}
          className="mt-2 text-[9px] font-semibold uppercase text-amber-300/90"
        >
          Resolve…
        </button>
      )}
    </li>
  );

  return (
    <section className="mb-4 rounded-2xl border border-amber-500/20 bg-[#050b13]/88 p-4 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Decision queue
          </h2>
          <p className="text-[9px] text-slate-600">Human-only — Skipper recommends, never decides</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[9px] uppercase text-cyan-400/90"
        >
          Refresh
        </button>
      </div>
      {error ? <p className="mb-2 text-xs text-amber-200">{error}</p> : null}
      {loading && !bundle ? <p className="text-xs text-slate-500">Loading decisions…</p> : null}
      {bundle?.promotedCount ? (
        <p className="mb-2 text-[10px] text-slate-500">
          Promoted {bundle.promotedCount} item(s) from operational threads.
        </p>
      ) : null}
      <ul className="space-y-2">
        {(bundle?.pending ?? []).length === 0 && !loading ? (
          <li className="text-[10px] text-slate-500">No pending owner decisions.</li>
        ) : null}
        {(bundle?.pending ?? []).map(renderRow)}
      </ul>
      {(bundle?.deferred?.length ?? 0) > 0 ? (
        <>
          <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Deferred
          </h3>
          <ul className="mt-1 space-y-2">{(bundle?.deferred ?? []).map(renderRow)}</ul>
        </>
      ) : null}
    </section>
  );
}
