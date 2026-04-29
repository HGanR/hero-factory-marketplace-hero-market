"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { BENTLEY_WORKER_LAST_RUN_SESSION_KEY } from "@/lib/revenue-os/bentley-approval-worker-analytics-chat";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import type { ScheduledQueueSummaryJson } from "@/lib/revenue-os/bentley-scheduled-publish-chat";
import { cn } from "@/lib/utils";

function bottleneckLabel(b: string): string {
  if (b === "approval_waiting") return "Waiting on approval";
  if (b === "operational_failure") return "Operational / retries";
  if (b === "no_due_posts") return "Nothing due right now";
  if (b === "ready_to_run") return "Ready for worker";
  if (b === "mixed") return "Mixed factors";
  return b;
}

export function BentleyApprovalWorkerAnalyticsPanel() {
  const [scopeTick, setScopeTick] = useState(0);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScheduledQueueSummaryJson | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("airos_debug") === "1");
  }, []);

  useEffect(() => {
    const onScope = () => setScopeTick((t) => t + 1);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    return () => window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
  }, []);

  const clientId = useMemo(() => {
    void scopeTick;
    return getBentleyStorageScope()?.clientId ?? "_";
  }, [scopeTick]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let approvalSession = false;
      try {
        approvalSession = sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1";
      } catch {
        approvalSession = false;
      }
      let workerParam = "";
      try {
        const raw = sessionStorage.getItem(BENTLEY_WORKER_LAST_RUN_SESSION_KEY);
        if (raw) workerParam = `&workerLastRun=${encodeURIComponent(raw)}`;
      } catch {
        /* ignore */
      }
      const approvalParam = approvalSession ? "&approvalSession=1" : "";
      const cid = clientId === "_" ? "" : clientId;
      const r = await fetch(
        `/api/campaigns/scheduled-queue?clientId=${encodeURIComponent(cid)}${approvalParam}${workerParam}`
      );
      if (r.ok) {
        setData((await r.json()) as ScheduledQueueSummaryJson);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  useEffect(() => {
    const onFocus = () => setRefreshNonce((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const aw = data?.approvalWorker;
  const s = aw?.summary;
  const insight = aw?.insight;

  return (
    <section
      id="bentley-approval-worker-analytics"
      data-bentley-section="approval-worker-analytics"
      className="rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Worker &amp; approval analytics</h3>
        <button
          type="button"
          onClick={() => setRefreshNonce((n) => n + 1)}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Separates <span className="text-slate-400">human approval</span> from{" "}
        <span className="text-slate-400">operational</span> blockers for timed publishing. Same data as chat when you ask
        about the worker queue.
      </p>

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}

      {!loading && !aw && <p className="mt-3 text-[11px] text-amber-200/80">Could not load queue analytics.</p>}

      {!loading && aw && s && insight && (
        <>
          <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Awaiting approval</div>
              <div className="text-lg font-semibold text-amber-200/90">{s.awaitingApproval}</div>
            </div>
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Approved &amp; eligible</div>
              <div className="text-lg font-semibold text-emerald-200/90">{s.approvedAndEligible}</div>
            </div>
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Due now, blocked by approval</div>
              <div className="text-lg font-semibold text-amber-200/90">{s.dueNowButBlockedByApproval}</div>
            </div>
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Failed (operational)</div>
              <div className="text-lg font-semibold text-red-200/85">{s.failedOperationally}</div>
            </div>
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Retry scheduled</div>
              <div className="text-lg font-semibold text-violet-200/85">{s.retryScheduled}</div>
            </div>
            <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
              <div className="text-slate-500">Primary bottleneck</div>
              <div className={cn("text-sm font-medium", insight.primaryBottleneck === "mixed" && "text-slate-200")}>
                {bottleneckLabel(insight.primaryBottleneck)}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-300">{insight.summaryText}</p>
          <p className="mt-1 text-[11px] text-cyan-200/85">{insight.recommendation}</p>
          <p className="mt-2 text-[10px] text-slate-500">
            Optional: paste the JSON body from <code className="text-slate-400">POST /api/internal/scheduled-publish/run</code>{" "}
            into sessionStorage key <code className="text-slate-400">{BENTLEY_WORKER_LAST_RUN_SESSION_KEY}</code> to surface{" "}
            <strong className="text-slate-400">skippedByApproval</strong> from your last cron run.
          </p>
        </>
      )}

      {debug && aw && s && (
        <div className="mt-3 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] text-slate-400 space-y-1">
          <div>
            effective approval mode: {aw.effectiveApprovalRequired ? "on" : "off"} · session UI toggle:{" "}
            {typeof window !== "undefined"
              ? (() => {
                  try {
                    return sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1" ? "on" : "off";
                  } catch {
                    return "?";
                  }
                })()
              : "—"}
          </div>
          <div>
            due-now blocked by approval: {s.dueNowButBlockedByApproval} · worker-eligible (in queue):{" "}
            {s.approvedAndEligible} · skippedByApproval (last run echo): {s.skippedByApproval}
          </div>
          {aw.lastWorkerRun ? (
            <div className="whitespace-pre-wrap break-all">last worker snapshot: {JSON.stringify(aw.lastWorkerRun)}</div>
          ) : (
            <div>last worker snapshot: —</div>
          )}
        </div>
      )}
    </section>
  );
}
