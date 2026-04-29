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
import { buildContentBatchRoutingForWorkflow } from "@/lib/revenue-os/bentley-content-batch-routing-chat";
import type {
  RevenueOsContentBatchRole,
  RevenueOsRoutedContentItem,
} from "@/lib/revenue-os/content-batch-routing-types";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
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

export function BentleyContentBatchRoutingPanel() {
  useAiRevenueOsSnapshotSignature();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const [scopeTick, setScopeTick] = useState(0);
  const [wf, setWf] = useState(loadWorkflowState);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsWithRoleMeta, setPostsWithRoleMeta] = useState(0);
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

  const [batchPack, setBatchPack] = useState<ReturnType<typeof buildContentBatchRoutingForWorkflow> | null>(
    null
  );

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
      const summary = buildContentBatchRoutingForWorkflow({
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        platformRoleRouting: routing,
        optimizationMemoryGeneration: mem?.generation ?? null,
      });
      setBatchPack(summary);

      let withRole = 0;
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
                const u = p.utmParams?.bentley_content_role ?? p.utmParams?.["bentley_content_role"];
                if (u) withRole += 1;
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
      setPostsWithRoleMeta(withRole);
      setPostsInspected(inspected);
    } finally {
      setLoading(false);
    }
  }, [clientId, launchPlan, systemSignals, wf.artifacts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byRole = useMemo(() => {
    const m = new Map<RevenueOsContentBatchRole, RevenueOsRoutedContentItem[]>();
    if (!batchPack) return m;
    for (const it of batchPack.items) {
      const arr = m.get(it.role) ?? [];
      arr.push(it);
      m.set(it.role, arr);
    }
    return m;
  }, [batchPack]);

  return (
    <section
      id="bentley-content-batch-routing"
      data-bentley-section="content-batch-routing"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Content batch routing</h3>
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
        Groups generated copy by role (awareness, conversation, authority, etc.) and suggests platforms — hints only.
      </p>

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}

      {!loading && batchPack && (
        <>
          <p className="mt-3 text-xs text-slate-300">{batchPack.nextAction}</p>
          <div className="mt-3 space-y-2">
            {(
              [
                "attention",
                "engagement",
                "authority",
                "lead_capture",
                "distribution_support",
              ] as RevenueOsContentBatchRole[]
            ).map((role) => {
              const items = byRole.get(role) ?? [];
              const n = batchPack.countsByRole[role] ?? 0;
              const plats = batchPack.recommendedPlatformsByRole[role]?.join(", ") || "—";
              if (n === 0) return null;
              return (
                <details
                  key={role}
                  className="rounded-md border border-slate-800/90 bg-slate-900/40 px-2 py-1.5"
                >
                  <summary className="cursor-pointer list-none text-xs font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
                    <span className="capitalize">{role.replace(/_/g, " ")}</span>
                    <span className="ml-2 text-slate-500">· {n} item(s)</span>
                    <span className="ml-2 text-[10px] text-slate-500">Platforms: {plats}</span>
                  </summary>
                  <ul className="mt-2 space-y-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                    {items.map((it) => (
                      <li key={it.id ?? it.title}>
                        <span
                          className={cn("mr-2 rounded border px-1 py-0.5 text-[9px] uppercase", confClass(it.confidence))}
                        >
                          {it.confidence}
                        </span>
                        <span className="text-slate-300">{it.title ?? it.source}</span>
                        <p className="mt-0.5 line-clamp-3 text-slate-500">{it.body}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
          {!batchPack.items.length ? (
            <p className="mt-3 text-xs text-amber-200/80">No generated pieces to route yet — add campaign, content bundle, or launch plan.</p>
          ) : null}
        </>
      )}

      {debug && batchPack && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] text-slate-400">
          <div>routed items: {batchPack.items.length}</div>
          <div>counts: {JSON.stringify(batchPack.countsByRole)}</div>
          <div>low-confidence items: {batchPack.items.filter((i) => i.confidence === "low").length}</div>
          <div>platform hint coverage: {batchPack.roleHintsFromPlatformRouting ? "yes" : "no"}</div>
          <div>
            posts with bentley_content_role (sample campaign): {postsWithRoleMeta} / {postsInspected} inspected
          </div>
        </div>
      )}
    </section>
  );
}
