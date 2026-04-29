"use client";

import { useEffect, useState } from "react";
import type { CampaignGovernedSocialAnalyticsPayload } from "@/lib/social/governed-post-analytics-aggregate";

function fmtNum(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function supportLabel(s: "live" | "stub_unsupported" | "no_adapter"): string {
  if (s === "live") return "Live sync";
  if (s === "stub_unsupported") return "Stub";
  return "No adapter";
}

export function CampaignPublishingAnalyticsSummary(props: {
  campaignId: string;
  /** Increment when planner list refresh completes so rollups stay in sync. */
  refreshToken?: number;
  /** After a successful batch refresh, bump planner/aggregate data (e.g. `refreshPlanner`). */
  onBatchAnalyticsComplete?: () => void;
}) {
  const { campaignId, refreshToken = 0, onBatchAnalyticsComplete } = props;
  const [data, setData] = useState<CampaignGovernedSocialAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/social/campaign-analytics?campaignId=${encodeURIComponent(campaignId)}`);
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string } & Partial<
          CampaignGovernedSocialAnalyticsPayload
        >;
        if (cancelled) return;
        if (!r.ok) {
          setData(null);
          setError((j as { message?: string }).message || "Could not load campaign analytics.");
          return;
        }
        setData(j as CampaignGovernedSocialAnalyticsPayload);
      } catch {
        if (!cancelled) {
          setData(null);
          setError("Could not load campaign analytics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, refreshToken]);

  const runBatchRefresh = async () => {
    setBatchBusy(true);
    setBatchSummary(null);
    setError(null);
    try {
      const r = await fetch("/api/social/campaign-analytics/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        succeededCount?: number;
        failedCount?: number;
        skippedCount?: number;
        attemptedCount?: number;
      };
      if (!r.ok || !j.ok) {
        setError(j.error || "Batch refresh failed.");
        return;
      }
      const s = j.succeededCount ?? 0;
      const f = j.failedCount ?? 0;
      const sk = j.skippedCount ?? 0;
      const at = j.attemptedCount ?? 0;
      setBatchSummary(`Batch refresh: ${s} succeeded, ${sk} skipped, ${f} failed (${at} attempted).`);
      onBatchAnalyticsComplete?.();
    } catch {
      setError("Batch refresh failed.");
    } finally {
      setBatchBusy(false);
    }
  };

  if (!campaignId) return null;

  const m = data?.aggregateMetrics;
  const sum = m?.engagementsTotal?.sum;
  const impr = m?.impressions?.sum;

  return (
    <div
      data-testid="planner-campaign-analytics-summary"
      className="mt-3 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300"
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        Campaign performance (latest snapshot / post)
      </div>
      {loading ? (
        <p data-testid="planner-campaign-analytics-loading" className="text-slate-500">
          Loading rollups…
        </p>
      ) : null}
      {error ? (
        <p data-testid="planner-campaign-analytics-error" className="text-rose-300/90">
          {error}
        </p>
      ) : null}
      {!loading && !error && data ? (
        <div className="space-y-2">
          <p data-testid="planner-campaign-analytics-coverage" className="text-slate-400 leading-snug">
            {data.coverage.headline}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
            <span>
              Published:{" "}
              <strong className="text-slate-200">{data.campaignSummary.publishedPostCount}</strong> governed
            </span>
            <span>
              With snapshot:{" "}
              <strong className="text-slate-200">{data.campaignSummary.postsWithLatestSnapshot}</strong>
            </span>
            {data.campaignSummary.postsPublishedNeverSynced > 0 ? (
              <span className="text-amber-200/85">
                Not synced yet: {data.campaignSummary.postsPublishedNeverSynced}
              </span>
            ) : null}
            {data.campaignSummary.postsMissingRemotePostId > 0 ? (
              <span className="text-amber-200/85">Missing remote post id: {data.campaignSummary.postsMissingRemotePostId}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
            <span className="text-slate-500">
              Impressions (sum): <strong className="text-slate-200">{fmtNum(impr)}</strong>
              {m?.impressions?.posts != null ? (
                <span className="text-slate-600"> · {m.impressions.posts} posts</span>
              ) : null}
            </span>
            <span className="text-slate-500">
              Engagements total (sum): <strong className="text-slate-200">{fmtNum(sum)}</strong>
              {m?.engagementsTotal?.posts != null ? (
                <span className="text-slate-600"> · {m.engagementsTotal.posts} posts</span>
              ) : null}
            </span>
            {data.freshness.freshestSnapshotAt ? (
              <span className="text-slate-500">
                Newest fetch:{" "}
                <time dateTime={data.freshness.freshestSnapshotAt}>
                  {new Date(data.freshness.freshestSnapshotAt).toLocaleString()}
                </time>
              </span>
            ) : (
              <span className="text-slate-600">No snapshot timestamps yet.</span>
            )}
          </div>
          {data.providerSummaries.length > 0 ? (
            <div data-testid="planner-campaign-analytics-providers" className="space-y-1 border-t border-slate-800/80 pt-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-600">By provider</div>
              <ul className="space-y-1">
                {data.providerSummaries.map((p) => (
                  <li
                    key={p.provider}
                    data-testid={`planner-campaign-analytics-provider-${p.provider}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-slate-900/50 px-2 py-1"
                  >
                    <span className="font-medium text-slate-200">
                      {p.displayName}
                      <span className="ml-1.5 font-normal text-slate-500">({supportLabel(p.metricSyncSupport)})</span>
                    </span>
                    <span className="text-slate-500">
                      {p.postsWithLatestSnapshot}/{p.publishedPosts} synced
                      {p.metrics.impressions?.sum != null ? (
                        <span className="text-slate-400"> · {fmtNum(p.metrics.impressions.sum)} impr</span>
                      ) : null}
                      {p.metrics.engagementsTotal?.sum != null ? (
                        <span className="text-slate-400"> · {fmtNum(p.metrics.engagementsTotal.sum)} eng</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ul className="text-[9px] text-slate-600 list-disc pl-4 space-y-0.5">
            {data.coverage.notes.slice(0, 3).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          {data.liveAdapterProviders.length > 0 ? (
            <p className="text-[9px] text-slate-600">
              Live metric adapters in this deployment: {data.liveAdapterProviders.join(", ")}.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2">
            <button
              type="button"
              data-testid="planner-campaign-analytics-batch-refresh"
              disabled={batchBusy || data.liveAdapterProviders.length === 0}
              title={
                data.liveAdapterProviders.length === 0
                  ? "No live metric adapters — batch refresh would not run fetches."
                  : "Refresh up to 25 published posts (oldest posted first). Clamped to 50 max if you pass a higher limit via API."
              }
              className="rounded border border-cyan-600/45 bg-cyan-950/25 px-2 py-1 text-[10px] font-medium text-cyan-100 disabled:opacity-40"
              onClick={() => void runBatchRefresh()}
            >
              {batchBusy ? "Refreshing…" : "Refresh campaign analytics"}
            </button>
            <span className="text-[9px] text-slate-600 max-w-[220px] leading-snug">
              Up to {25} posts per run (API max 50), oldest published first. Skips unsupported providers and missing remote
              ids.
            </span>
          </div>
          <p
            data-testid="planner-campaign-analytics-scheduled-hint"
            className="text-[9px] text-slate-600 leading-snug border-t border-slate-800/60 pt-1.5"
          >
            Scheduled refresh (cron):{" "}
            <code className="text-slate-500">POST /api/internal/social/governed-post-analytics-scheduled-refresh</code>{" "}
            with the same internal worker secret as other cron jobs — prioritizes never-synced and stalest snapshots, uses
            provider-aware throttling/backoff and per-provider caps; see docs.
          </p>
          {batchSummary ? (
            <p data-testid="planner-campaign-analytics-batch-result" className="text-[10px] text-emerald-200/90">
              {batchSummary}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
