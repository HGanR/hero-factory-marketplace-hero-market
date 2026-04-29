"use client";

import { useCallback, useEffect, useState } from "react";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { BENTLEY_PIPELINE_PROGRESS_EVENT } from "@/lib/revenue-os/bentley-pipeline-progress";
import type { BentleyOptimizationResult } from "@/lib/revenue-os/bentley-optimization";

type OptimizationComparison = {
  parentCampaignId?: string;
  childCampaignId?: string;
  ctrDeltaRelative?: number | null;
  engagementRateDelta?: number | null;
  conversionProxyDeltaRelative?: number | null;
  parent?: { impressions?: number | null; clicks?: number | null; publishedWithSnapshot?: number };
  child?: { impressions?: number | null; clicks?: number | null; publishedWithSnapshot?: number };
};

type LatestRun = {
  id: string;
  campaignId: string;
  childCampaignId: string | null;
  executionMode: string;
  createdAt: string;
  result: BentleyOptimizationResult;
  executionTrace?: Record<string, unknown> | null;
  comparison?: OptimizationComparison | null;
  improvementScore?: string | null;
  winningVariant?: boolean | null;
};

export function BentleyOptimizationInsightsPanel() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const wf = loadWorkflowState();
    const cid = wf.artifacts.bentleyDbCampaignId?.trim() ?? null;
    setCampaignId(cid);
    if (!cid) {
      setLatest(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/revenue-os/bentley/optimization/latest?campaignId=${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; run?: LatestRun | null; error?: string };
      if (!res.ok) {
        setError(j.error ?? "Could not load optimization state.");
        setLatest(null);
        return;
      }
      setLatest(j.run ?? null);
    } catch {
      setError("Network error loading optimization.");
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, on);
    window.addEventListener("bentley-workflow-updated", on);
    const unsub = subscribeBentleyWorkflowCrossTab(refresh);
    return () => {
      window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, on);
      window.removeEventListener("bentley-workflow-updated", on);
      unsub();
    };
  }, [refresh]);

  const runRecommendOnly = async () => {
    if (!campaignId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/revenue-os/bentley/optimization/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, mode: "recommend_only" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Optimization run failed.");
        return;
      }
      await refresh();
    } catch {
      setError("Network error running optimization.");
    } finally {
      setRunning(false);
    }
  };

  if (!campaignId) {
    return (
      <div className="mb-4 rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">
        <p className="font-semibold uppercase tracking-wide text-slate-500">Bentley optimization</p>
        <p className="mt-1">Persist a campaign from Bentley first — optimization reads governed post analytics for your DB campaign.</p>
      </div>
    );
  }

  const r = latest?.result;

  const improvementPct =
    latest?.improvementScore != null && latest.improvementScore !== ""
      ? Number.parseFloat(latest.improvementScore) * 100
      : null;
  const showWin =
    latest?.winningVariant === true &&
    improvementPct != null &&
    Number.isFinite(improvementPct);

  return (
    <div className="mb-4 rounded-xl border border-violet-500/35 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">Bentley optimization</p>
          <p className="mt-1 text-xs text-slate-400">
            Uses live governed social rollups, post statuses, and approval backlog — not generic AI tips.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runRecommendOnly()}
          disabled={running || loading}
          className="shrink-0 rounded-lg border border-violet-500/50 bg-violet-950/50 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/60 disabled:opacity-50"
        >
          {running ? "Running…" : "Refresh insight"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}

      {loading && !r ? (
        <p className="mt-2 text-xs text-slate-500">Loading last optimization…</p>
      ) : !latest ? (
        <p className="mt-2 text-xs text-slate-400">
          No optimization run yet. Click <strong className="text-slate-200">Refresh insight</strong> to analyze current
          performance signals.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5 text-xs">
          <p>
            <span className="text-slate-500">Data readiness:</span>{" "}
            <span className="text-slate-100">{r?.status ?? "—"}</span>
            {" · "}
            <span className="text-slate-500">Confidence:</span>{" "}
            <span className="text-slate-100">{r?.confidence ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500">Primary bottleneck:</span>{" "}
            <span className="font-medium text-violet-100/95">{r?.primaryDriver ?? "—"}</span>
          </p>
          {r?.findings?.length ? (
            <ul className="list-disc pl-4 text-slate-300">
              {r.findings.slice(0, 4).map((f) => (
                <li key={f.code}>{f.detail}</li>
              ))}
            </ul>
          ) : null}
          {r?.recommendations?.length ? (
            <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-slate-300">
              <span className="text-slate-500">Next move:</span> {r.recommendations[0]?.text}
            </div>
          ) : null}
          {latest.campaignId ? (
            <p className="pt-1 break-all text-slate-400">
              <span className="text-slate-500">Lineage:</span> parent{" "}
              <code className="text-slate-300">{latest.campaignId}</code>
              {latest.childCampaignId ? (
                <>
                  {" → "}
                  <span className="text-slate-500">variant</span>{" "}
                  <code className="text-violet-200">{latest.childCampaignId}</code>
                  <span className="text-slate-500"> · run mode {latest.executionMode}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {latest.comparison && latest.childCampaignId ? (
            <div className="mt-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-slate-300">
              <p className="text-slate-500">Parent vs variant (governed rollups)</p>
              <ul className="mt-1 list-disc pl-4 text-slate-400">
                <li>
                  CTR delta (relative):{" "}
                  {latest.comparison.ctrDeltaRelative != null
                    ? `${(latest.comparison.ctrDeltaRelative * 100).toFixed(1)}%`
                    : "—"}
                </li>
                <li>
                  Engagement rate delta:{" "}
                  {latest.comparison.engagementRateDelta != null
                    ? `${(latest.comparison.engagementRateDelta * 100).toFixed(2)} pp`
                    : "—"}
                </li>
                <li>
                  Conversion proxy (CTR vs parent):{" "}
                  {latest.comparison.conversionProxyDeltaRelative != null
                    ? `${(latest.comparison.conversionProxyDeltaRelative * 100).toFixed(1)}%`
                    : "—"}
                </li>
              </ul>
            </div>
          ) : null}

          {showWin ? (
            <p className="mt-1 text-emerald-200/95">
              Bentley improved this variant by about {improvementPct!.toFixed(0)}% on the composite score (CTR +
              engagement blend — directional, not a guarantee).
            </p>
          ) : latest?.winningVariant === false && improvementPct != null && Number.isFinite(improvementPct) ? (
            <p className="mt-1 text-amber-200/90">
              Latest variant did not beat the parent baseline on the composite score (~{improvementPct.toFixed(0)}%).
            </p>
          ) : null}

          {latest?.executionTrace && typeof latest.executionTrace === "object" ? (
            <p className="pt-1 text-slate-500">
              Execution:{" "}
              {String((latest.executionTrace as { syncAttempted?: boolean }).syncAttempted ? "posts synced" : "no auto-sync")}
              {typeof (latest.executionTrace as { postCreationMode?: string }).postCreationMode === "string"
                ? ` (${(latest.executionTrace as { postCreationMode: string }).postCreationMode})`
                : ""}
            </p>
          ) : null}

          {!latest.childCampaignId ? (
            <p className="text-slate-500 pt-1">
              No child campaign created — last run was recommendation-only or did not meet confidence gates for variants.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
