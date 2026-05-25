"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";

type Props = {
  subjectId: ExecutiveSubjectId;
  clientId: string;
  orderId: string;
  approvalId?: string;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  onThreadsLoaded?: (threads: ExecutiveOperationalThreadDto[]) => void;
  embedded?: boolean;
};

function priorityClass(p: string): string {
  switch (p) {
    case "urgent":
      return "border-red-500/50 text-red-200";
    case "high":
      return "border-amber-500/45 text-amber-100";
    default:
      return "border-slate-600/50 text-slate-400";
  }
}

export function SubjectThreadSidebar({
  subjectId,
  clientId,
  orderId,
  approvalId,
  selectedThreadId,
  onSelectThread,
  onThreadsLoaded,
  embedded = false,
}: Props) {
  const [threads, setThreads] = useState<ExecutiveOperationalThreadDto[]>([]);
  const [openDecisionCounts, setOpenDecisionCounts] = useState<Record<string, number>>({});
  const [activeTaskCounts, setActiveTaskCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ subjectId, limit: "30" });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (orderId.trim()) params.set("orderId", orderId.trim());
      if (approvalId?.trim()) params.set("approvalId", approvalId.trim());
      const r = await fetch(`/api/admin/executive-agent/threads?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        threads?: ExecutiveOperationalThreadDto[];
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        setError(j.message ?? j.error ?? `Load failed (${r.status})`);
        setThreads([]);
        setOpenDecisionCounts({});
        setActiveTaskCounts({});
        onThreadsLoaded?.([]);
        return;
      }
      const list = j.threads ?? [];
      setThreads(list);
      onThreadsLoaded?.(list);

      const dParams = new URLSearchParams({ subjectId, promote: "false", limit: "80" });
      if (clientId.trim()) dParams.set("clientId", clientId.trim());
      if (orderId.trim()) dParams.set("orderId", orderId.trim());
      const dr = await fetch(`/api/admin/executive-agent/decisions?${dParams}`, {
        credentials: "include",
        cache: "no-store",
      });
      const dj = (await dr.json().catch(() => ({}))) as {
        pending?: Array<{ threadId: string | null }>;
      };
      const counts: Record<string, number> = {};
      for (const d of dj.pending ?? []) {
        if (d.threadId) counts[d.threadId] = (counts[d.threadId] ?? 0) + 1;
      }
      setOpenDecisionCounts(counts);

      const tParams = new URLSearchParams({ subjectId });
      if (clientId.trim()) tParams.set("clientId", clientId.trim());
      if (orderId.trim()) tParams.set("orderId", orderId.trim());
      const tr = await fetch(`/api/admin/executive-agent/tasks?${tParams}`, {
        credentials: "include",
        cache: "no-store",
      });
      const tj = (await tr.json().catch(() => ({}))) as {
        open?: Array<{ threadId: string | null; isOverdue?: boolean; isBlocked?: boolean }>;
        inProgress?: Array<{ threadId: string | null }>;
        blocked?: Array<{ threadId: string | null }>;
        overdue?: Array<{ threadId: string | null }>;
      };
      const tCounts: Record<string, number> = {};
      for (const bucket of [tj.open, tj.inProgress, tj.blocked, tj.overdue]) {
        for (const t of bucket ?? []) {
          if (t.threadId) tCounts[t.threadId] = (tCounts[t.threadId] ?? 0) + 1;
        }
      }
      setActiveTaskCounts(tCounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setThreads([]);
      setOpenDecisionCounts({});
      setActiveTaskCounts({});
      onThreadsLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, clientId, orderId, approvalId, onThreadsLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <aside
      className={
        embedded
          ? "flex flex-col"
          : "flex h-full min-h-[200px] w-full flex-col rounded-xl border border-slate-700/60 bg-slate-950/60 lg:max-w-[220px]"
      }
    >
      {!embedded ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Ops threads
          </h3>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[9px] uppercase text-cyan-400/90 hover:text-cyan-300"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="text-[9px] uppercase text-cyan-400/90 hover:text-cyan-300"
          >
            Refresh
          </button>
        </div>
      )}
      <p className={`text-[9px] text-slate-600 ${embedded ? "mb-2" : "px-3 pb-1"}`}>
        Internal only — no client messaging
      </p>
      {error ? <p className={`text-[10px] text-amber-200/90 ${embedded ? "" : "px-3"}`}>{error}</p> : null}
      <ul className={`flex-1 space-y-1 overflow-y-auto pb-2 ${embedded ? "" : "px-2"}`}>
        {loading && threads.length === 0 ? (
          <li className="px-2 py-3 text-[10px] text-slate-500">Loading…</li>
        ) : null}
        {!loading && threads.length === 0 ? (
          <li className="px-2 py-3 text-[10px] text-slate-500">No threads for this scope.</li>
        ) : null}
        {threads.map((t) => {
          const active = selectedThreadId === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelectThread(active ? null : t.id)}
                className={`w-full rounded-lg border px-2 py-2 text-left text-[10px] transition ${
                  active
                    ? "border-violet-500/50 bg-violet-950/40 text-violet-100"
                    : "border-transparent bg-slate-900/30 text-slate-300 hover:border-slate-700/80"
                }`}
              >
                <div className="font-medium leading-snug">{t.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className={`rounded border px-1 text-[8px] uppercase ${priorityClass(t.priority)}`}>
                    {t.priority}
                  </span>
                  <span className="text-[8px] uppercase text-slate-500">{t.status}</span>
                  {(openDecisionCounts[t.id] ?? 0) > 0 ? (
                    <span className="rounded border border-amber-500/50 bg-amber-950/40 px-1 text-[8px] font-semibold text-amber-200">
                      {openDecisionCounts[t.id]} dec
                    </span>
                  ) : t.decisionNeeded ? (
                    <span className="rounded border border-amber-500/40 px-1 text-[8px] text-amber-200">
                      decision
                    </span>
                  ) : null}
                  {t.unresolvedQuestionCount > 0 ? (
                    <span className="text-[8px] text-cyan-400/80">{t.unresolvedQuestionCount} Q</span>
                  ) : null}
                  {(activeTaskCounts[t.id] ?? 0) > 0 ? (
                    <span className="rounded border border-cyan-500/40 px-1 text-[8px] text-cyan-200">
                      {activeTaskCounts[t.id]} task
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
