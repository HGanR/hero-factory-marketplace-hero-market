"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type {
  ExecutiveOperationalTaskDto,
  ExecutiveOperationalTasksQueueDto,
} from "@/lib/executive-agent/executive-operational-tasks";

type Props = {
  subjectId: ExecutiveSubjectId;
  clientId: string;
  orderId: string;
  threadId?: string | null;
  decisionId?: string | null;
  onTasksChanged?: () => void;
  embedded?: boolean;
};

function statusBadge(task: ExecutiveOperationalTaskDto): string {
  if (task.isOverdue) return "border-red-500/50 text-red-200";
  if (task.isBlocked) return "border-amber-500/45 text-amber-100";
  if (task.status === "in_progress") return "border-cyan-500/40 text-cyan-200";
  return "border-slate-600/50 text-slate-400";
}

export function ExecutiveTaskQueuePanel({
  subjectId,
  clientId,
  orderId,
  threadId,
  decisionId,
  onTasksChanged,
  embedded = false,
}: Props) {
  const [queue, setQueue] = useState<ExecutiveOperationalTasksQueueDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ subjectId });
      if (clientId.trim()) params.set("clientId", clientId.trim());
      if (orderId.trim()) params.set("orderId", orderId.trim());
      if (threadId?.trim()) params.set("threadId", threadId.trim());
      if (decisionId?.trim()) params.set("decisionId", decisionId.trim());
      const r = await fetch(`/api/admin/executive-agent/tasks?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveOperationalTasksQueueDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Load failed (${r.status})`);
        setQueue(null);
        return;
      }
      setQueue(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQueue(null);
    } finally {
      setLoading(false);
    }
  }, [subjectId, clientId, orderId, threadId, decisionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = async (taskId: string, path: string, body?: Record<string, unknown>) => {
    setBusyId(taskId);
    try {
      const r = await fetch(`/api/admin/executive-agent/tasks/${taskId}/${path}`, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `${path} failed (${r.status})`);
        return;
      }
      onTasksChanged?.();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const renderTask = (t: ExecutiveOperationalTaskDto) => (
    <li
      key={t.id}
      className="rounded-lg border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-xs text-slate-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-100">{t.title}</div>
          <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{t.description}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`rounded border px-1 text-[8px] uppercase ${statusBadge(t)}`}>
              {t.status}
            </span>
            <span className="text-[8px] uppercase text-slate-500">{t.priority}</span>
            {t.ownerLabel ? (
              <span className="text-[8px] text-slate-600">{t.ownerLabel}</span>
            ) : null}
            {t.department ? (
              <span className="text-[8px] text-violet-400/80">{t.department}</span>
            ) : null}
            {t.isOverdue ? (
              <span className="rounded border border-red-500/40 px-1 text-[8px] text-red-200">
                overdue
              </span>
            ) : null}
            {t.dependencyBlocked ? (
              <span className="text-[8px] text-amber-400/80">deps</span>
            ) : null}
            {t.recommendedAgent ? (
              <span className="text-[8px] italic text-slate-600">→ {t.recommendedAgent}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {t.status === "open" ? (
          <button
            type="button"
            disabled={busyId === t.id || t.dependencyBlocked}
            onClick={() => void action(t.id, "start")}
            className="rounded border border-cyan-500/35 px-2 py-0.5 text-[9px] uppercase text-cyan-200 disabled:opacity-40"
          >
            Start
          </button>
        ) : null}
        {t.status === "in_progress" || t.status === "open" ? (
          <button
            type="button"
            disabled={busyId === t.id}
            onClick={() => void action(t.id, "complete", {})}
            className="rounded border border-emerald-500/35 px-2 py-0.5 text-[9px] uppercase text-emerald-200 disabled:opacity-40"
          >
            Complete
          </button>
        ) : null}
        {t.status !== "completed" && t.status !== "canceled" ? (
          <>
            <button
              type="button"
              disabled={busyId === t.id}
              onClick={() => {
                const reason = window.prompt("Block reason");
                if (reason?.trim()) void action(t.id, "block", { blockedReason: reason.trim() });
              }}
              className="rounded border border-amber-500/35 px-2 py-0.5 text-[9px] uppercase text-amber-200 disabled:opacity-40"
            >
              Block
            </button>
            <button
              type="button"
              disabled={busyId === t.id}
              onClick={() => void action(t.id, "cancel", {})}
              className="rounded border border-slate-600/50 px-2 py-0.5 text-[9px] uppercase text-slate-400 disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>
    </li>
  );

  const active = [
    ...(queue?.overdue ?? []),
    ...(queue?.blocked ?? []),
    ...(queue?.inProgress ?? []),
    ...(queue?.open ?? []),
  ];

  return (
    <section
      className={
        embedded
          ? ""
          : "mb-4 rounded-2xl border border-cyan-500/18 bg-[#050b13]/88 p-4 backdrop-blur-md"
      }
    >
      {!embedded ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
              Task queue
            </h2>
            <p className="text-[9px] text-slate-600">Human-coordinated — no autonomous execution</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[9px] uppercase text-cyan-400/90"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="text-[9px] uppercase text-cyan-400/90"
          >
            Refresh
          </button>
        </div>
      )}
      {error ? <p className="mb-2 text-xs text-amber-200">{error}</p> : null}
      {loading && !queue ? <p className="text-xs text-slate-500">Loading tasks…</p> : null}
      {(queue?.recommendations?.length ?? 0) > 0 ? (
        <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-950/15 px-2 py-2 text-[10px] text-violet-200/90">
          <span className="font-semibold uppercase text-violet-400/80">Skipper recommends</span>
          <ul className="mt-1 space-y-1">
            {queue!.recommendations.slice(0, 3).map((r) => (
              <li key={r.taskId}>
                {r.title}: {r.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {active.length === 0 && !loading ? (
          <li className="text-[10px] text-slate-500">No active operational tasks.</li>
        ) : null}
        {active.map(renderTask)}
      </ul>
    </section>
  );
}
