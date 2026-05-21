"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveFulfillmentOperationalMemoryInsightsDto } from "@/lib/fulfillment/fulfillment-operational-memory-types";

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function OperationalMemoryInsightsPanel() {
  const [insights, setInsights] = useState<ExecutiveFulfillmentOperationalMemoryInsightsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        "/api/admin/executive-agent/fulfillment-operations/memory-insights",
        { credentials: "include", cache: "no-store" }
      );
      const j = (await r.json().catch(() => ({}))) as ExecutiveFulfillmentOperationalMemoryInsightsDto & {
        message?: string;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Memory insights failed (${r.status})`);
        setInsights(null);
        return;
      }
      setInsights(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const h = insights?.highlights;
  const mem = insights?.memory;

  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Operational memory insights
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Read-only learning · no autonomous actions · recommendations weighted from desk history
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-slate-600/60 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/60"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading memory insights…</p> : null}

      {insights && !loading ? (
        <div className="mt-3 space-y-4 text-xs text-slate-300">
          <p className="text-sm text-violet-100/90">{insights.headline}</p>
          <p className="text-[11px] text-slate-400">{insights.skipperSummary}</p>

          {h ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Low-revision WEBSITE" value={String(h.websiteLowRevisionDrafts)} />
              <Stat label="TRUST stall signals" value={String(h.trustStalledPackets)} />
              <Stat label="Clients need guidance" value={String(h.clientsNeedingGuidance)} />
              <Stat label="Orders analyzed" value={String(mem?.ordersAnalyzed ?? 0)} />
            </div>
          ) : null}

          {insights.revisionAnalytics ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Revision analytics</h4>
              <ul className="mt-1 list-inside list-disc text-[11px] text-slate-400">
                <li>WEBSITE avg draft v{insights.revisionAnalytics.websiteAvgDraftVersion}</li>
                <li>
                  Revision-request rate:{" "}
                  {Math.round(insights.revisionAnalytics.websiteRevisionRequestedRate * 100)}%
                </li>
                <li>
                  TRUST owner-review pending rate:{" "}
                  {Math.round(insights.revisionAnalytics.trustOwnerReviewPendingRate * 100)}%
                </li>
                {insights.revisionAnalytics.topRevisionThemes.length ? (
                  <li>Themes: {insights.revisionAnalytics.topRevisionThemes.join(", ")}</li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {mem?.recommendationSignals?.length ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">
                Recommendation effectiveness
              </h4>
              <ul className="mt-1 space-y-1">
                {mem.recommendationSignals.slice(0, 5).map((s) => (
                  <li key={s.kind} className="text-[11px] text-slate-400">
                    <span className="text-violet-200/90">{s.kind}</span> — score {s.effectivenessScore}:{" "}
                    {s.insight}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {mem?.operatorPatterns?.length ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Owner priority patterns</h4>
              <ul className="mt-1 space-y-1">
                {mem.operatorPatterns.slice(0, 5).map((p) => (
                  <li key={p.actionKey} className="text-[11px] text-slate-400">
                    {p.label} ({p.occurrenceCount}×, {Math.round(p.shareOfDeskActivity * 100)}% desk share)
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {mem?.bottleneckRecurrence?.length ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Recurring bottlenecks</h4>
              <ul className="mt-1 space-y-1">
                {mem.bottleneckRecurrence.slice(0, 4).map((b) => (
                  <li key={b.id} className="text-[11px] text-slate-400">
                    {b.summary} (recurrence {b.recurrenceScore})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {mem?.approvalLatency?.length ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Approval latency</h4>
              <ul className="mt-1 space-y-1">
                {mem.approvalLatency.slice(0, 4).map((a) => (
                  <li key={a.proposedAction} className="text-[11px] text-slate-400">
                    {a.proposedAction}: median {a.medianHoursToExecute ?? "—"}h ({a.sampleCount} samples)
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {mem?.clientLifecycle?.length ? (
            <section>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Client lifecycle</h4>
              <ul className="mt-1 space-y-1">
                {mem.clientLifecycle
                  .filter((c) => c.guidanceScore >= 55)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.clientId} className="text-[11px] text-slate-400">
                      {shortId(c.clientId)} — {c.revisionBurden} revision burden: {c.insight}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-700/50 bg-slate-900/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
