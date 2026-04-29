"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAiRevenueOsSnapshotSignature } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import {
  fetchRevenueOsOptimizationMemory,
  postRevenueOsOptimizationMemoryRefresh,
  type RevenueOsOptimizationMemoryApiResponse,
} from "@/lib/revenue-os/optimization-memory-client-fetch";
import { cn } from "@/lib/utils";

const REFRESH_AT_KEY = "airos_optimization_memory_refresh_at";

export function BentleyOptimizationMemoryPanel() {
  useAiRevenueOsSnapshotSignature();
  const [scopeTick, setScopeTick] = useState(0);
  const [debug, setDebug] = useState(false);
  const [pack, setPack] = useState<RevenueOsOptimizationMemoryApiResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("airos_debug") === "1");
  }, []);

  const clientId = useMemo(() => {
    void scopeTick;
    return getBentleyStorageScope()?.clientId ?? "_";
  }, [scopeTick]);

  useEffect(() => {
    const onScope = () => setScopeTick((t) => t + 1);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    return () => window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const cid = clientId === "_" ? "" : clientId;
      const wDbg =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("airos_debug") === "1";
      const data = await fetchRevenueOsOptimizationMemory(cid, undefined, { includeWeightingDebug: wDbg });
      setPack(data);
      if (!data) setLoadError(true);
    } catch {
      setLoadError(true);
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runRebuild = useCallback(async () => {
    setRefreshing(true);
    try {
      const cid = clientId === "_" ? "" : clientId;
      const r = await postRevenueOsOptimizationMemoryRefresh({ clientId: cid || undefined, feedbackLimit: 120 });
      if (r?.ok) {
        try {
          sessionStorage.setItem(REFRESH_AT_KEY, new Date().toISOString());
        } catch {
          /* ignore */
        }
        await refresh();
      }
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, [clientId, refresh]);

  const summary = pack?.summary;
  const stats = pack?.stats;
  const gen = pack?.generation;

  const sessionRefreshAt = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(REFRESH_AT_KEY);
    } catch {
      return null;
    }
  }, [pack, refreshing]);

  return (
    <section
      id="bentley-optimization-memory"
      data-bentley-section="optimization-memory"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Optimization memory</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className={cn(
              "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300",
              "hover:border-slate-500 hover:text-white"
            )}
          >
            Reload
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void runRebuild()}
            className={cn(
              "rounded-md border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 text-xs text-cyan-100/90",
              "hover:border-cyan-600/80 hover:text-white disabled:opacity-50"
            )}
          >
            {refreshing ? "Rebuilding…" : "Rebuild from feedback"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Learned weak priors from publishes + metrics. Biases future generation — not proof of what caused results.
      </p>

      {summary && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {summary.hasEnoughData ? (
            <span className="inline-flex items-center rounded-full border border-emerald-900/50 bg-emerald-950/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200/90">
              Enough history
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
              Insufficient data
            </span>
          )}
          {summary.summaryConfidence === "high" ? (
            <span className="inline-flex rounded-full border border-cyan-900/40 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200/85">
              High confidence
            </span>
          ) : summary.summaryConfidence === "medium" ? (
            <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
              Medium confidence
            </span>
          ) : summary.hasEnoughData ? (
            <span className="inline-flex rounded-full border border-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Low confidence
            </span>
          ) : null}
        </div>
      )}

      {!loading && !loadError && (summary?.measuredStrongestAttentionPlatform || summary?.measuredStrongestEngagementPlatform) ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {summary.measuredStrongestAttentionPlatform ? (
            <span className="inline-flex rounded-md border border-violet-900/50 bg-violet-950/30 px-2 py-0.5 text-[10px] font-medium text-violet-200/90">
              Attention · {summary.measuredStrongestAttentionPlatform}
            </span>
          ) : null}
          {summary.measuredStrongestEngagementPlatform ? (
            <span className="inline-flex rounded-md border border-teal-900/50 bg-teal-950/30 px-2 py-0.5 text-[10px] font-medium text-teal-200/90">
              Engagement · {summary.measuredStrongestEngagementPlatform}
            </span>
          ) : null}
          {summary.crossPlatformComparisonConfidence === "high" ? (
            <span className="inline-flex rounded-md border border-cyan-900/40 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-medium text-cyan-200/85">
              Compare · high
            </span>
          ) : summary.crossPlatformComparisonConfidence === "medium" ? (
            <span className="inline-flex rounded-md border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              Compare · medium
            </span>
          ) : summary.crossPlatformComparisonConfidence ? (
            <span className="inline-flex rounded-md border border-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              Compare · low
            </span>
          ) : null}
        </div>
      ) : !loading && !loadError && summary?.measuredStrongestPlatform ? (
        <p className="mt-2 text-xs text-emerald-200/85">
          <span className="text-slate-500">Strongest measured (composite) · </span>
          <span className="font-medium capitalize">{summary.measuredStrongestPlatform}</span>
        </p>
      ) : null}
      {!loading &&
      !loadError &&
      summary?.measuredStrongestAttentionPlatform &&
      summary?.measuredStrongestEngagementPlatform &&
      summary.measuredStrongestAttentionPlatform !== summary.measuredStrongestEngagementPlatform ? (
        <p className="mt-1 text-[11px] text-amber-200/75">Directional only — unlike metric classes in memory.</p>
      ) : null}
      {!loading && !loadError && summary?.operationalStrongestPlatform ? (
        <p className="mt-2 text-xs text-slate-400">
          <span className="text-slate-500">Strongest operational (publish-only in memory) · </span>
          <span className="font-medium capitalize">{summary.operationalStrongestPlatform}</span>
        </p>
      ) : null}

      {!loading && !loadError && summary?.instagramMeasuredPreference?.active ? (
        <div className="mt-2 rounded-md border border-cyan-900/40 bg-cyan-950/20 px-2 py-1.5 text-xs text-cyan-100/90">
          <p className="font-medium text-cyan-50/95">{summary.instagramMeasuredPreference.userHeadline}</p>
          <p className="mt-0.5 text-[11px] text-cyan-200/75">
            Why: strongest attention-style (impressions) signal from synced Instagram vs other channels’ available metrics.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Confidence:{" "}
            <span className="capitalize text-slate-200">{summary.instagramMeasuredPreference.confidenceLabel}</span>
          </p>
          {gen?.instagramPreferenceHint || gen?.measuredPlatformRoleHint || gen?.platformRoleRoutingHint ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Generation may receive short platform hints (cross-platform roles + job-to-be-done routing; subordinate to your brief).
            </p>
          ) : null}
        </div>
      ) : null}

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}
      {!loading && loadError && (
        <p className="mt-3 text-amber-200/90">Couldn’t load memory (try signing in or reloading).</p>
      )}

      {!loading && !loadError && summary && (
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="text-slate-500">Next generation</p>
            <p className="mt-0.5 text-slate-200">{summary.nextGenerationRecommendation}</p>
            {gen?.measuredPlatformRoleHint ? (
              <p className="mt-1 text-[10px] text-slate-500">Cross-platform line: {gen.measuredPlatformRoleHint}</p>
            ) : null}
            {gen?.platformRoleRoutingHint ? (
              <p className="mt-1 text-[10px] text-slate-500">Role routing line: {gen.platformRoleRoutingHint}</p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-slate-800/90 bg-slate-900/40 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stronger patterns</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                {summary.strongestPatterns.slice(0, 3).map((e, i) => (
                  <li key={`${e.patternKey ?? i}-${e.platform}`}>
                    <span className="font-medium text-slate-100">{e.platform}</span> · {e.outcomeKind}
                    {e.evidenceQuality === "live_metrics" ? (
                      <span className="ml-1 rounded bg-emerald-950/60 px-1 text-[9px] text-emerald-200/90">Measured</span>
                    ) : e.evidenceQuality === "publish_only" ? (
                      <span className="ml-1 rounded bg-slate-800 px-1 text-[9px] text-slate-400">Publish-only</span>
                    ) : e.evidenceQuality === "unsupported" ? (
                      <span className="ml-1 rounded bg-slate-800 px-1 text-[9px] text-slate-500">No metrics sync</span>
                    ) : null}
                    <span className="text-slate-500"> — </span>
                    {e.summary.slice(0, 120)}
                    {e.summary.length > 120 ? "…" : ""}
                  </li>
                ))}
                {!summary.strongestPatterns.length ? <li className="text-slate-500">None yet.</li> : null}
              </ul>
            </div>
            <div className="rounded-md border border-slate-800/90 bg-slate-900/40 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Weaker patterns</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                {summary.weakestPatterns.slice(0, 3).map((e, i) => (
                  <li key={`${e.patternKey ?? i}-w-${e.platform}`}>
                    <span className="font-medium text-slate-100">{e.platform}</span> · {e.outcomeKind}
                    <span className="text-slate-500"> — </span>
                    {e.summary.slice(0, 120)}
                    {e.summary.length > 120 ? "…" : ""}
                  </li>
                ))}
                {!summary.weakestPatterns.length ? <li className="text-slate-500">None flagged.</li> : null}
              </ul>
            </div>
          </div>
          <div>
            <p className="text-slate-500">Preferred platforms (hints)</p>
            <p className="mt-0.5 text-slate-300">
              {Object.keys(summary.platformPreferences).length
                ? Object.entries(summary.platformPreferences)
                    .slice(0, 4)
                    .map(([p, hints]) => `${p}: ${hints.slice(0, 2).join(" · ")}`)
                    .join(" · ")
                : "—"}
            </p>
          </div>
        </div>
      )}

      {debug && pack && stats && gen && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
          <div>memory rows (scope): {stats.entryCount}</div>
          <div>latest row update: {stats.latestUpdatedAt?.slice(0, 19)?.replace("T", " ") ?? "—"}</div>
          <div>session rebuild: {sessionRefreshAt?.slice(0, 19)?.replace("T", " ") ?? "—"}</div>
          <div>
            unified prompt would inject OPTIMIZATION_MEMORY: {gen.promptWouldInject ? "yes" : "no"}
          </div>
          <div>injected entry ids (if inject): {gen.injectedEntryIds.length ? gen.injectedEntryIds.join(", ") : "—"}</div>
          <div>prompt weighting: {gen.promptWeightingSummary ?? "—"}</div>
          {pack.weightingDebug ? (
            <>
              {pack.weightingDebug.crossPlatformMemory ? (
                <>
                  <div className="mt-2 text-slate-300">cross-platform memory (metric class / basis)</div>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                    {JSON.stringify(pack.weightingDebug.crossPlatformMemory, null, 2)}
                  </pre>
                </>
              ) : null}
              <div className="mt-2 text-slate-300">platform evidence weights (capability tier)</div>
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.weightingDebug.platformWeights, null, 2)}
              </pre>
              <div className="mt-1">recommendation basis: {pack.weightingDebug.recommendationBasis ?? "—"}</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.weightingDebug.entryConfidence, null, 2)}
              </pre>
            </>
          ) : null}
          <div className="mt-1 text-slate-500">
            Trace: publish/performance → memory rows → GET generation.* mirrors resolver used in content engine / campaign-from-notes.
          </div>
        </div>
      )}
    </section>
  );
}
