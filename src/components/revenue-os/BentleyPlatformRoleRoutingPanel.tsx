"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAiRevenueOsSnapshotSignature } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import {
  derivePlatformRoleRouting,
  type RevenueOsPlatformRoleRecommendation,
} from "@/lib/revenue-os/platform-role-routing";
import { cn } from "@/lib/utils";

function confBadgeClass(c: string): string {
  if (c === "high") return "border-cyan-900/40 bg-cyan-950/25 text-cyan-200/85";
  if (c === "medium") return "border-slate-700 bg-slate-900/50 text-slate-300";
  return "border-slate-800 text-slate-500";
}

export function BentleyPlatformRoleRoutingPanel() {
  useAiRevenueOsSnapshotSignature();
  const [scopeTick, setScopeTick] = useState(0);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [routing, setRouting] = useState<ReturnType<typeof derivePlatformRoleRouting> | null>(null);
  const [genUsedRoleHint, setGenUsedRoleHint] = useState(false);

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
      const [pack, mem] = await Promise.all([
        fetchRevenueOsDeploymentFeedback(cid),
        fetchRevenueOsOptimizationMemory(cid, undefined, { includeWeightingDebug: wDbg }),
      ]);
      if (!pack && !mem) {
        setLoadError(true);
        setRouting(null);
        setGenUsedRoleHint(false);
        return;
      }
      const r = derivePlatformRoleRouting({
        deploymentRollup: pack?.rollup ?? null,
        memorySummary: mem?.summary ?? null,
        metricSyncContext: pack?.metricSyncContext
          ? {
              liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
              stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
            }
          : null,
        signalsInput: pack?.signalsInput ?? null,
        systemSignals: null,
      });
      setRouting(r);
      setGenUsedRoleHint(Boolean(mem?.generation?.platformRoleRoutingHint?.trim()));
    } catch {
      setLoadError(true);
      setRouting(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const roleRow = (role: RevenueOsPlatformRoleRecommendation) => {
    const label = role.role.replace(/_/g, " ");
    return (
      <div
        key={role.role}
        className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-900/35 px-2 py-1.5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium capitalize text-slate-200">{label}</p>
          <p className="text-[10px] text-slate-500">
            {role.preferredPlatform ? (
              <span className="font-medium text-slate-300">{role.preferredPlatform}</span>
            ) : (
              <span>Insufficient data</span>
            )}
            <span className="text-slate-600"> · </span>
            <span className="italic">{role.evidenceBasis.replace(/_/g, " ")}</span>
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
            confBadgeClass(role.confidence)
          )}
        >
          {role.confidence}
        </span>
      </div>
    );
  };

  return (
    <section
      id="bentley-platform-role-routing"
      data-bentley-section="platform-role-routing"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Platform role routing</h3>
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
        By job-to-be-done (attention, engagement, authority, leads, distribution) — not a single generic “best
        platform.”
      </p>

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}
      {!loading && loadError && (
        <p className="mt-3 text-amber-200/90">Couldn’t load data (try signing in or refreshing).</p>
      )}

      {!loading && !loadError && routing && (
        <>
          <div className="mt-3 space-y-2">{routing.recommendations.map(roleRow)}</div>
          <p className="mt-3 rounded-md border border-slate-800/90 bg-slate-900/50 p-2 text-xs text-slate-200">
            {routing.operationalRecommendation}
          </p>
        </>
      )}

      {debug && routing && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
          <div>routing confidence notes: {routing.confidenceNotes.join(" · ") || "—"}</div>
          <div className="mt-1">
            generation used platformRoleRouting hint (memory API): {genUsedRoleHint ? "yes" : "no"}
          </div>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-slate-500">
            {JSON.stringify(
              routing.recommendations.map((r) => ({
                role: r.role,
                preferredPlatform: r.preferredPlatform,
                confidence: r.confidence,
                evidenceBasis: r.evidenceBasis,
              })),
              null,
              2
            )}
          </pre>
        </div>
      )}
    </section>
  );
}
