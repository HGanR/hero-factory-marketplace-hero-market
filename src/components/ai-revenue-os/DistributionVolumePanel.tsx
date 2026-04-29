"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, ListOrdered, Radio, Loader2 } from "lucide-react";
import { useAiRevenueOsContentCampaign, useAiRevenueOsProfile } from "@/components/ai-revenue-os/AiRevenueOsSharedState";

type QueueItem = {
  id: string;
  title: string;
  queueStatus: string;
  batchId: string | null;
  variationIndex: number | null;
  contentDeploymentId: string | null;
  updatedAt: string | null;
};

type VolRec = {
  postsPerWeekSuggested: { min: number; max: number };
  platformFocus: string[];
  rationale: string[];
  feedbackNotes: string[];
};

export function DistributionVolumePanel() {
  const profile = useAiRevenueOsProfile();
  const campaign = useAiRevenueOsContentCampaign();
  const shared = profile.isProviderActive;

  const [variationCount, setVariationCount] = useState(6);
  const [cloneFromVariantId, setCloneFromVariantId] = useState("");
  const [generationVariantId, setGenerationVariantId] = useState("");
  const [enqueue, setEnqueue] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchErr, setBatchErr] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [vol, setVol] = useState<VolRec | null>(null);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const r = await fetch("/api/bentley-social-leads/content-queue?limit=60", { credentials: "include" });
      if (r.status === 401) {
        setQueue([]);
        return;
      }
      const data = (await r.json()) as { items?: QueueItem[] };
      setQueue(data.items ?? []);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadVol = useCallback(async () => {
    try {
      const r = await fetch("/api/bentley-social-leads/volume-recommendations", { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { recommendation?: VolRec };
      setVol(data.recommendation ?? null);
    } catch {
      setVol(null);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadVol();
  }, [loadQueue, loadVol]);

  async function runBatch() {
    setBatchErr(null);
    setBatchLoading(true);
    try {
      const businessName = shared ? profile.businessName.trim() : "";
      const industry = shared ? profile.effectiveIndustryLabel.trim() : "";
      const targetAudience = shared ? profile.targetAudience.trim() : "";
      const coreOffer = shared ? profile.coreOffer.trim() : "";
      if (!businessName || !industry || !targetAudience || !coreOffer) {
        throw new Error("Fill in business context (profile / Analysis) or run from dashboard with data.");
      }
      const transformation = shared ? profile.transformation.trim() : "";
      const tone = campaign.tone || "Professional";
      const platform = "Instagram";
      const contentType = campaign.contentType || "Full Post";
      const notes = campaign.campaignNotes?.trim() ?? "";

      const r = await fetch("/api/revenue-os/content-engine/batch-variations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          industry,
          targetAudience,
          coreOffer,
          transformation,
          tone,
          platform,
          contentType,
          ...(notes ? { notes, campaignNotes: notes } : {}),
          variationCount,
          enqueueToQueue: enqueue,
          ...(cloneFromVariantId.trim() ? { cloneFromVariantId: cloneFromVariantId.trim() } : {}),
          ...(generationVariantId.trim() ? { generationVariantId: generationVariantId.trim() } : {}),
        }),
      });
      const data = (await r.json()) as { batchId?: string; error?: string; variationCount?: number };
      if (!r.ok) throw new Error(data?.error ?? "Batch failed");
      setLastBatchId(data.batchId ?? null);
      setBatchErr(null);
      await loadQueue();
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchLoading(false);
    }
  }

  async function patchQueue(id: string, patch: { queueStatus?: string; contentDeploymentId?: string | null }) {
    await fetch(`/api/bentley-social-leads/content-queue/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadQueue();
  }

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-black/40 p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">Distribution &amp; volume</h3>
      </div>

      <p className="text-sm text-slate-400">
        Batch-generate short-form variations (same core pattern, diverse hooks) with TikTok / Reels / Shorts packs, then
        track items in a **draft → ready → posted** queue. Link deployments for attribution and feedback into conversion
        analytics.
      </p>

      {vol ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
            <Radio className="w-4 h-4" />
            Volume recommendations
          </div>
          <p className="text-sm text-slate-300">
            Target <strong className="text-white">{vol.postsPerWeekSuggested.min}–{vol.postsPerWeekSuggested.max}</strong>{" "}
            posts/week.
          </p>
          <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">
            {vol.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500">Platform focus: {vol.platformFocus.join(" · ")}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <ListOrdered className="w-4 h-4 text-cyan-400" />
          Batch variations (5–10)
        </div>
        <label className="block text-xs text-slate-500">
          Count
          <input
            type="number"
            min={5}
            max={10}
            value={variationCount}
            onChange={(e) => setVariationCount(parseInt(e.target.value, 10) || 6)}
            className="mt-1 block w-24 bg-black/50 border border-white/15 rounded px-2 py-1 text-white text-sm"
          />
        </label>
        <label className="block text-xs text-slate-500">
          Clone from variant id (optional — winning snapshot bias)
          <input
            value={cloneFromVariantId}
            onChange={(e) => setCloneFromVariantId(e.target.value)}
            placeholder="uuid"
            className="mt-1 block w-full font-mono text-xs bg-black/50 border border-white/15 rounded px-2 py-1 text-white"
          />
        </label>
        <label className="block text-xs text-slate-500">
          Link queue rows to generation variant (optional)
          <input
            value={generationVariantId}
            onChange={(e) => setGenerationVariantId(e.target.value)}
            placeholder="uuid"
            className="mt-1 block w-full font-mono text-xs bg-black/50 border border-white/15 rounded px-2 py-1 text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={enqueue} onChange={(e) => setEnqueue(e.target.checked)} />
          Enqueue results to content queue (draft)
        </label>
        <button
          type="button"
          disabled={batchLoading}
          onClick={() => void runBatch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/70 text-white text-sm hover:bg-cyan-500/80 disabled:opacity-50"
        >
          {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {batchLoading ? "Generating…" : "Run batch"}
        </button>
        {lastBatchId ? (
          <p className="text-[10px] font-mono text-slate-500">
            Last batch: {lastBatchId}
          </p>
        ) : null}
        {batchErr ? <p className="text-xs text-rose-400">{batchErr}</p> : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-200">Content queue</p>
          <button type="button" onClick={() => void loadQueue()} className="text-xs text-slate-500 hover:text-white">
            Refresh
          </button>
        </div>
        {queueLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-slate-500">No queue items. Run a batch with enqueue, or POST to the queue API.</p>
        ) : (
          <ul className="space-y-2 text-xs text-slate-300 max-h-64 overflow-y-auto">
            {queue.map((q) => (
              <li key={q.id} className="border border-white/10 rounded-lg p-2 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium truncate">{q.title || q.id.slice(0, 8)}</span>
                  <span className="text-[10px] uppercase text-slate-500">{q.queueStatus}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => void patchQueue(q.id, { queueStatus: "ready" })}
                  >
                    Mark ready
                  </button>
                  <button
                    type="button"
                    className="text-emerald-400 hover:underline"
                    onClick={() => void patchQueue(q.id, { queueStatus: "posted" })}
                  >
                    Mark posted
                  </button>
                </div>
                <label className="text-[10px] text-slate-500 block">
                  Deployment id
                  <input
                    defaultValue={q.contentDeploymentId ?? ""}
                    placeholder="paste deployment uuid"
                    className="mt-0.5 w-full font-mono bg-black/50 border border-white/15 rounded px-1 py-0.5 text-white"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== (q.contentDeploymentId ?? "")) void patchQueue(q.id, { contentDeploymentId: v });
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
