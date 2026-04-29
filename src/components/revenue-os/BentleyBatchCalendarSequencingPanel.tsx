"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { buildSevenDayLaunchPlan } from "@/lib/revenue-os/build-seven-day-launch-plan";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import { derivePlatformRoleRouting } from "@/lib/revenue-os/platform-role-routing";
import { buildBatchCalendarSequencingForWorkflow } from "@/lib/revenue-os/bentley-batch-calendar-sequencing-chat";
import { buildContentBatchRoutingForWorkflow } from "@/lib/revenue-os/bentley-content-batch-routing-chat";
import {
  buildDeploymentReadyPostDrafts,
  type DeploymentReadyPostDraft,
} from "@/lib/revenue-os/bentley-deployment-orchestrator";
import type { SocialPlatform } from "@/lib/social/config";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  x: "X",
};

function confClass(c: string): string {
  if (c === "high") return "border-cyan-900/40 text-cyan-200/85";
  if (c === "medium") return "border-slate-600 text-slate-300";
  return "border-slate-800 text-slate-500";
}

export function BentleyBatchCalendarSequencingPanel() {
  useAiRevenueOsSnapshotSignature();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const [scopeTick, setScopeTick] = useState(0);
  const [wf, setWf] = useState(loadWorkflowState);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsWithSeqMeta, setPostsWithSeqMeta] = useState(0);
  const [postsInspected, setPostsInspected] = useState(0);

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

  useEffect(() => {
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWf(loadWorkflowState()));
    return unsub;
  }, []);

  const shared = useMemo(
    () => ({
      businessName: profile.businessName,
      coreOffer: profile.coreOffer,
      transformation: profile.transformation,
      targetAudience: profile.targetAudience,
      industry: profile.effectiveIndustryLabel,
      postingPlatforms: postingPlatforms.map((x) => PLATFORM_LABELS[x] ?? x),
    }),
    [profile, postingPlatforms]
  );

  const launchPlan = useMemo(
    () =>
      buildSevenDayLaunchPlan({
        systemSignals,
        sharedProfile: shared,
        trendsResult: wf.artifacts.trends ?? undefined,
        researchResult: wf.artifacts.research ?? undefined,
        workflowState: wf,
      }),
    [systemSignals, shared, wf]
  );

  const [sequencePack, setSequencePack] = useState<ReturnType<typeof buildBatchCalendarSequencingForWorkflow> | null>(
    null
  );
  const [draftsSample, setDraftsSample] = useState<DeploymentReadyPostDraft[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cid = clientId === "_" ? "" : clientId;
      const [pack, mem] = await Promise.all([
        fetchRevenueOsDeploymentFeedback(cid),
        fetchRevenueOsOptimizationMemory(cid),
      ]);
      const routing = derivePlatformRoleRouting({
        deploymentRollup: pack?.rollup ?? null,
        memorySummary: mem?.summary ?? null,
        metricSyncContext: pack?.metricSyncContext
          ? {
              liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
              stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
            }
          : null,
        signalsInput: pack?.signalsInput ?? null,
        systemSignals,
      });
      const seq = buildBatchCalendarSequencingForWorkflow({
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        platformRoleRouting: routing,
        optimizationMemoryGeneration: mem?.generation ?? null,
        systemSignals,
      });
      setSequencePack(seq);

      const batchRouting = buildContentBatchRoutingForWorkflow({
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        platformRoleRouting: routing,
        optimizationMemoryGeneration: mem?.generation ?? null,
      });
      const dr = buildDeploymentReadyPostDrafts({
        sharedProfile: { postingPlatforms: shared.postingPlatforms },
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        systemSignals,
        platformRoleRoutingSummary: routing,
        applyContentBatchMetadata: true,
        batchCalendarSequence: seq.slots.length ? seq : null,
        applySequenceMetadata: true,
      });
      setDraftsSample(dr);

      let withSeq = 0;
      let inspected = 0;
      try {
        const r = await fetch(`/api/campaigns?clientId=${encodeURIComponent(cid)}`);
        if (r.ok) {
          const j = (await r.json()) as { campaigns?: { id: string }[] };
          const first = j.campaigns?.[0]?.id;
          if (first) {
            const pr = await fetch(`/api/campaigns/${first}`);
            if (pr.ok) {
              const pj = (await pr.json()) as { posts?: { utmParams?: Record<string, string> | null }[] };
              const posts = pj.posts ?? [];
              inspected = posts.length;
              for (const p of posts) {
                const u = p.utmParams?.bentley_sequence_day_index ?? p.utmParams?.["bentley_sequence_day_index"];
                if (u) withSeq += 1;
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
      setPostsWithSeqMeta(withSeq);
      setPostsInspected(inspected);
    } finally {
      setLoading(false);
    }
  }, [clientId, launchPlan, systemSignals, wf.artifacts, shared.postingPlatforms]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section
      id="bentley-batch-calendar-sequencing"
      data-bentley-section="batch-calendar-sequencing"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Batch calendar sequencing</h3>
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
        Suggested day order for routed roles — aligns loosely with launch days when a plan exists. Hints only.
      </p>

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}

      {!loading && sequencePack && (
        <>
          {sequencePack.slots.length === 0 ? (
            <p className="mt-3 text-xs text-amber-200/85">{sequencePack.summary}</p>
          ) : (
            <ol className="mt-3 space-y-2 list-decimal list-inside text-xs">
              {sequencePack.slots.map((s, idx) => (
                <li key={`${s.role}-${s.dayIndex}-${idx}`} className="rounded-md border border-slate-800/90 bg-slate-900/35 px-2 py-1.5">
                  <span className="font-medium text-slate-100">
                    Day {s.dayIndex} · {s.role.replace(/_/g, " ")}
                  </span>
                  <span
                    className={cn("ml-2 rounded border px-1 py-0.5 text-[9px] uppercase", confClass(s.confidence))}
                  >
                    {s.confidence}
                  </span>
                  <p className="mt-0.5 text-slate-500">
                    Platforms: {s.preferredPlatforms.length ? s.preferredPlatforms.join(", ") : "—"}
                    {s.itemIds?.length ? ` · ${s.itemIds.length} item id(s)` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-3">{s.reason}</p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-500">{sequencePack.sequencingStrategy}</p>
        </>
      )}

      {debug && sequencePack?.diagnostics && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] text-slate-400 space-y-1">
          <div>sequence slots: {sequencePack.diagnostics.slotCount}</div>
          <div>roles omitted (had content but not sequenced): {sequencePack.diagnostics.rolesOmittedLowSignal.join(", ") || "—"}</div>
          <div>lead_capture suppressed: {String(sequencePack.diagnostics.leadCaptureSuppressed)}</div>
          <div>launch alignment applied: {String(sequencePack.diagnostics.launchAlignmentApplied)}</div>
          <div>authority-first: {String(sequencePack.diagnostics.authorityFirstApplied)}</div>
          <div>
            deployment sample drafts with sequence fields:{" "}
            {draftsSample.filter((d) => d.bentleySequenceDayIndex != null).length}/{draftsSample.length}
          </div>
          <div>
            posts with bentley_sequence_day_index (sample campaign): {postsWithSeqMeta}/{postsInspected} inspected
          </div>
        </div>
      )}
    </section>
  );
}
