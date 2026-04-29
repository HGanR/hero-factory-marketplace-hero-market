"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import type { RevenueOsDeploymentFeedbackApiResponse } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { cn } from "@/lib/utils";

export function BentleyDeploymentFeedbackPanel() {
  useAiRevenueOsSnapshotSignature();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const [scopeTick, setScopeTick] = useState(0);
  const [debug, setDebug] = useState(false);
  const [pack, setPack] = useState<RevenueOsDeploymentFeedbackApiResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const syncDebug =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("airos_debug") === "1";
      const data = await fetchRevenueOsDeploymentFeedback(cid, undefined, { includeSyncDebug: syncDebug });
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

  const rollup = pack?.rollup;
  const latest = pack?.latest;
  const topHint = rollup?.recommendationHints?.[0];

  const dashboardEnrichedFlag = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("airos_dashboard_deployment_feedback_enriched") === "1";
    } catch {
      return false;
    }
  }, [pack, systemSignals.deploymentFeedbackEnriched]);

  return (
    <section
      id="bentley-deployment-feedback"
      data-bentley-section="deployment-feedback"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Deployment feedback</h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className={cn(
            "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300",
            "hover:border-slate-500 hover:text-white"
          )}
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Publish outcomes + optional channel metrics (performance sync). Conservative rollups — not a full analytics suite.
      </p>

      {pack?.metricSyncContext?.liveMetricPlatforms?.length ? (
        <p className="mt-2 text-xs text-emerald-200/85">
          Real API metrics available for:{" "}
          <span className="font-medium">{pack.metricSyncContext.liveMetricPlatforms.join(", ")}</span> (after sync
          runs). Other platforms may be publish-only until adapters ship.
        </p>
      ) : null}

      {pack?.metricSyncContext?.stubPublishPlatforms?.map((p) => (
        <p key={p} className="mt-1 text-xs text-amber-200/80">
          <span className="font-medium capitalize">{p}</span>: publishing supported — metric sync not wired yet (delivery
          state only in loop).
        </p>
      ))}

      {rollup?.hasPerformanceMetrics && (
        <div className="mt-2 inline-flex items-center rounded-full border border-cyan-800/60 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200/90">
          Metrics in loop
        </div>
      )}

      {rollup && !rollup.hasPerformanceMetrics && pack?.metricSyncContext?.liveMetricPlatforms?.length ? (
        <p className="mt-2 text-xs text-slate-400">
          No impressions in DB yet for this scope — run platform performance sync (or wait for cron).{" "}
          <span className="text-slate-500">Publish rows alone do not add channel metrics.</span>
        </p>
      ) : null}

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}
      {!loading && loadError && (
        <p className="mt-3 text-amber-200/90">Couldn’t load feedback (try signing in or refreshing).</p>
      )}
      {!loading && !loadError && rollup && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Published</dt>
            <dd className="font-medium text-emerald-300">{rollup.publishedCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Failed</dt>
            <dd className="font-medium text-rose-300">{rollup.failedCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Retries</dt>
            <dd className="font-medium text-amber-200">{rollup.retryCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Top platform</dt>
            <dd className="font-medium text-slate-100">
              {rollup.bestMeasuredPlatform ? (
                <span className="text-emerald-200/90">{rollup.bestMeasuredPlatform} · measured</span>
              ) : rollup.bestPublishedPlatform ? (
                <span>
                  {rollup.bestPublishedPlatform}
                  <span className="text-slate-500"> · operational</span>
                </span>
              ) : rollup.bestPlatform ? (
                rollup.hasPerformanceMetrics ? (
                  rollup.bestPlatform
                ) : (
                  `${rollup.bestPlatform} (by volume)`
                )
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      )}

      {!loading && !loadError && rollup?.hasPerformanceMetrics && (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>
            <span className="text-slate-500">Attention signal: </span>
            <span className="font-medium capitalize">{rollup.attentionSignalStrength}</span>
          </p>
          {(rollup.bestAttentionPlatform || rollup.bestEngagementPlatform) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {rollup.bestAttentionPlatform ? (
                <span className="inline-flex rounded-md border border-violet-900/50 bg-violet-950/30 px-2 py-0.5 text-[10px] font-medium text-violet-200/90">
                  Best attention · {rollup.bestAttentionPlatform}
                </span>
              ) : null}
              {rollup.bestEngagementPlatform ? (
                <span className="inline-flex rounded-md border border-teal-900/50 bg-teal-950/30 px-2 py-0.5 text-[10px] font-medium text-teal-200/90">
                  Best engagement · {rollup.bestEngagementPlatform}
                </span>
              ) : null}
              {rollup.comparisonConfidence === "high" ? (
                <span className="inline-flex rounded-md border border-cyan-900/40 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-medium text-cyan-200/85">
                  Compare conf · high
                </span>
              ) : rollup.comparisonConfidence === "medium" ? (
                <span className="inline-flex rounded-md border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  Compare conf · medium
                </span>
              ) : rollup.comparisonConfidence ? (
                <span className="inline-flex rounded-md border border-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Compare conf · low
                </span>
              ) : null}
            </div>
          )}
          {rollup.bestAttentionPlatform &&
          rollup.bestEngagementPlatform &&
          rollup.bestAttentionPlatform !== rollup.bestEngagementPlatform ? (
            <p className="mt-1 text-[11px] text-amber-200/75">
              Directional only — attention vs engagement are different metric classes.
            </p>
          ) : null}
          {rollup.latestMetricSyncedAt ? (
            <p>
              <span className="text-slate-500">Latest metric sync: </span>
              {rollup.latestMetricSyncedAt.slice(0, 19).replace("T", " ")}
            </p>
          ) : null}
        </div>
      )}

      {!loading && !loadError && latest && (
        <p className="mt-3 text-xs text-slate-300">
          <span className="text-slate-500">Latest row: </span>
          <span className="font-medium capitalize">{latest.publishStatus}</span>
          <span className="text-slate-500"> · </span>
          {latest.platform}
          {latest.publishedAt ? <span className="text-slate-500"> · {latest.publishedAt.slice(0, 10)}</span> : null}
        </p>
      )}

      {!loading && !loadError && topHint && (
        <p className="mt-3 rounded-md border border-slate-800/90 bg-slate-900/50 p-2 text-xs text-slate-200">
          <span className="text-slate-500">Top hint · </span>
          {topHint}
        </p>
      )}

      {!loading && !loadError && rollup && rollup.recommendationHints.length > 1 && (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-300">
          {rollup.recommendationHints.slice(1, 4).map((h, i) => (
            <li key={`${i}-${h.slice(0, 24)}`}>{h}</li>
          ))}
        </ul>
      )}

      {systemSignals.deploymentFeedbackEnriched && (
        <p className="mt-3 text-xs text-cyan-200/80">
          System signals include a conservative nudge from deployment feedback.
        </p>
      )}

      {debug && pack && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
          <div>rows: {pack.rowCount}</div>
          <div>
            metric-enriched: {pack.metricEnrichedCount} · performance_rows: {pack.performanceMetricsRowCount ?? 0} ·
            publish-only: {pack.publishOnlyCount}
          </div>
          <div>signals enriched (UI): {systemSignals.deploymentFeedbackEnriched ? "yes" : "no"}</div>
          <div>dashboard load enrichment flag: {dashboardEnrichedFlag ? "yes" : "no"}</div>
          {pack.rollup?.crossPlatformComparableDebug ? (
            <>
              <div className="mt-2 text-slate-300">cross-platform comparable (debug)</div>
              <div className="mt-1 text-slate-500">
                primary basis: {pack.rollup.crossPlatformComparableDebug.primaryComparisonBasis} · platforms:{" "}
                {pack.rollup.crossPlatformComparableDebug.measuredLivePlatformsInComparison.join(", ") || "—"}
              </div>
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.rollup.crossPlatformComparableDebug.perPlatform, null, 2)}
              </pre>
              <div className="mt-1 text-slate-500">
                recommendation basis: attention vs engagement leaders above; confidence notes:{" "}
                {pack.rollup.crossPlatformComparableDebug.confidenceNotes.join(" · ") || "—"}
              </div>
            </>
          ) : null}
          {pack.metricSyncDebug ? (
            <>
              <div className="mt-2 text-slate-300">metric sync adapters (real | stub | none):</div>
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.metricSyncDebug.adapterImplementationByPlatform, null, 2)}
              </pre>
              <div className="mt-2 text-slate-300">evidence weights (rollup / memory tiering)</div>
              <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.metricSyncDebug.evidenceWeightsByPlatform, null, 2)}
              </pre>
              <div className="mt-1 text-slate-500">
                measured vs published rollup:{" "}
                {JSON.stringify(pack.metricSyncDebug.rollupMeasuredVsPublished)}
              </div>
              <div className="mt-1">
                Posted rows with remote id: {pack.metricSyncDebug.remoteIdStats.withRemoteId} of{" "}
                {pack.metricSyncDebug.remoteIdStats.posted} POSTED
              </div>
              {pack.metricSyncDebug.latestMetricSnapshot ? (
                <div className="mt-1 text-slate-500">
                  latest metric snapshot: {pack.metricSyncDebug.latestMetricSnapshot.platform} · source=
                  {pack.metricSyncDebug.latestMetricSnapshot.sourcePlatform ?? "—"} · synced=
                  {pack.metricSyncDebug.latestMetricSnapshot.syncedAt?.slice(0, 19) ?? "—"}
                </div>
              ) : (
                <div className="mt-1 text-slate-500">latest metric snapshot: none</div>
              )}
              <div className="mt-2 text-slate-300">auth / scope hints (capabilities):</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-slate-500">
                {JSON.stringify(pack.metricSyncDebug.authConstraintsByPlatform, null, 2)}
              </pre>
            </>
          ) : null}
          <div className="mt-1 text-slate-500">
            Internal POST /api/internal/platform-performance-sync/run returns a summary JSON for workers (not shown here).
          </div>
          {pack.latestMetricFeedback ? (
            <div className="mt-2 text-slate-500">
              latest metric snapshot: {pack.latestMetricFeedback.platform} · imp=
              {pack.latestMetricFeedback.impressions ?? "—"} · clicks={pack.latestMetricFeedback.clicks ?? "—"}
            </div>
          ) : null}
          {pack.platformSyncSupport ? (
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-slate-500">
              {JSON.stringify(pack.platformSyncSupport, null, 2)}
            </pre>
          ) : null}
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-slate-500">
            {JSON.stringify(
              {
                rollup: pack.rollup,
                latest: pack.latest
                  ? {
                      campaignPostId: pack.latest.campaignPostId,
                      platform: pack.latest.platform,
                      publishStatus: pack.latest.publishStatus,
                      source: pack.latest.source,
                      feedbackRowKind: pack.latest.feedbackRowKind,
                    }
                  : null,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </section>
  );
}
