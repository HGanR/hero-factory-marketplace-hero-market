"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import { derivePlatformRoleRouting } from "@/lib/revenue-os/platform-role-routing";
import { buildBatchCalendarSequencingForWorkflow } from "@/lib/revenue-os/bentley-batch-calendar-sequencing-chat";
import {
  applySequenceScheduleToDrafts,
  type CampaignPostForScheduleApply,
} from "@/lib/revenue-os/apply-sequence-schedule-to-drafts";
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

export function BentleySequenceSchedulePanel() {
  useAiRevenueOsSnapshotSignature();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const [scopeTick, setScopeTick] = useState(0);
  const [wf, setWf] = useState(loadWorkflowState);
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [timezoneInput, setTimezoneInput] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastApplyStats, setLastApplyStats] = useState<{
    matched: number;
    patches: number;
    skippedOverwrite: number;
    guidanceOnly: boolean;
  } | null>(null);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("airos_debug") === "1");
    try {
      setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setBrowserTz(null);
    }
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
  const [schedulePlan, setSchedulePlan] = useState<ReturnType<typeof buildSequenceSchedulePlan> | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [posts, setPosts] = useState<CampaignPostForScheduleApply[]>([]);

  const effectiveTz = timezoneInput.trim() || browserTz || null;

  const refresh = useCallback(async () => {
    void refreshNonce;
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

      const plan = buildSequenceSchedulePlan({
        batchCalendarSequence: seq,
        launchPlan,
        now: new Date(),
        userTimezoneHint: effectiveTz,
      });
      setSchedulePlan(plan);

      let camp: string | null = null;
      const postRows: CampaignPostForScheduleApply[] = [];
      try {
        const r = await fetch(`/api/campaigns?clientId=${encodeURIComponent(cid)}`);
        if (r.ok) {
          const j = (await r.json()) as { campaigns?: { id: string }[] };
          camp = j.campaigns?.[0]?.id ?? null;
          if (camp) {
            const pr = await fetch(`/api/campaigns/${camp}`);
            if (pr.ok) {
              const pj = (await pr.json()) as {
                posts?: {
                  id: string;
                  platform: string;
                  scheduledAt: string | Date | null;
                  utmParams?: Record<string, string> | null;
                }[];
              };
              for (const p of pj.posts ?? []) {
                postRows.push({
                  id: p.id,
                  platform: p.platform,
                  scheduledAt: p.scheduledAt,
                  utmParams: p.utmParams ?? null,
                });
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
      setCampaignId(camp);
      setPosts(postRows);
      setLastApplyStats(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, launchPlan, systemSignals, wf.artifacts, effectiveTz, refreshNonce]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyStats = useMemo(() => {
    if (!schedulePlan?.slots.length || !sequencePack) return null;
    const guidance = applySequenceScheduleToDrafts({
      posts,
      schedulePlan,
      batchCalendarSequence: sequencePack,
      guidanceOnly: true,
    });
    const dryRun = applySequenceScheduleToDrafts({
      posts,
      schedulePlan,
      batchCalendarSequence: sequencePack,
      confirmSetScheduledAt: true,
      confirmReplaceScheduledAt: false,
    });
    return { guidance, dryRun };
  }, [posts, schedulePlan, sequencePack]);

  const runPatches = async (
    rows: ReturnType<typeof applySequenceScheduleToDrafts>["rows"],
    opts: { setScheduled: boolean; useBentleySource: boolean }
  ) => {
    let patches = 0;
    for (const row of rows) {
      if (row.action === "skip" || row.action === "needs_replace_confirm") continue;
      const body: Record<string, unknown> = {};
      if (row.mergedUtmParams) body.utmParams = row.mergedUtmParams;
      if (opts.setScheduled && row.action === "set_scheduled_at" && row.nextScheduledAtIso) {
        body.scheduledAt = row.nextScheduledAtIso;
        if (opts.useBentleySource) body.scheduledPublishSourceHint = "bentley_sequence_apply";
      }
      if (Object.keys(body).length === 0) continue;
      const r = await fetch(`/api/campaigns/posts/${row.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j === "object" && j && "message" in j ? String((j as { message?: string }).message) : `HTTP ${r.status}`);
      }
      patches += 1;
    }
    return patches;
  };

  const onGuidanceOnly = async () => {
    if (!schedulePlan || !sequencePack || !applyStats) return;
    const rows = applyStats.guidance.rows.filter((r) => r.mergedUtmParams);
    if (!rows.length) {
      toast.message("No matching draft posts to update.");
      return;
    }
    setBusy(true);
    try {
      const patches = await runPatches(rows, { setScheduled: false, useBentleySource: false });
      setLastApplyStats({
        matched: applyStats.guidance.matchedCount,
        patches,
        skippedOverwrite: applyStats.guidance.overwriteProtectionCount,
        guidanceOnly: true,
      });
      toast.success(`Saved schedule guidance on ${patches} post(s) (utmParams only).`);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update posts.");
    } finally {
      setBusy(false);
    }
  };

  const onApplySchedule = async (replaceConfirmed: boolean) => {
    if (!schedulePlan || !sequencePack || !applyStats) return;
    const plan = applySequenceScheduleToDrafts({
      posts,
      schedulePlan,
      batchCalendarSequence: sequencePack,
      confirmSetScheduledAt: true,
      confirmReplaceScheduledAt: replaceConfirmed,
    });
    const blocked = plan.rows.filter((r) => r.action === "needs_replace_confirm").length;
    if (blocked > 0 && !replaceConfirmed) {
      toast.error(`${blocked} post(s) already scheduled — confirm overwrite or use guidance only.`);
      return;
    }
    setBusy(true);
    try {
      const patches = await runPatches(plan.rows, { setScheduled: true, useBentleySource: true });
      setLastApplyStats({
        matched: plan.matchedCount,
        patches,
        skippedOverwrite: plan.overwriteProtectionCount,
        guidanceOnly: false,
      });
      toast.success(`Updated ${patches} post(s) (schedule + metadata where applicable).`);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply schedule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="bentley-sequence-schedule"
      data-bentley-section="sequence-schedule"
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Sequence → schedule</h3>
        <button
          type="button"
          onClick={() => {
            setRefreshNonce((t) => t + 1);
          }}
          className={cn(
            "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300",
            "hover:border-slate-500 hover:text-white"
          )}
        >
          Refresh schedule
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Directional suggested times from your batch calendar sequence. Metadata is safe; actual{" "}
        <code className="text-slate-500">scheduledAt</code> only after you confirm here.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
          Timezone (IANA, optional)
          <input
            value={timezoneInput}
            onChange={(e) => setTimezoneInput(e.target.value)}
            placeholder={browserTz ?? "e.g. America/New_York"}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 w-56"
          />
        </label>
        {browserTz && !timezoneInput.trim() ? (
          <span className="text-[10px] text-slate-600">Using browser: {browserTz}</span>
        ) : null}
      </div>

      {loading && <p className="mt-3 text-slate-500">Loading…</p>}

      {!loading && schedulePlan && sequencePack && (
        <>
          {schedulePlan.slots.length === 0 ? (
            <p className="mt-3 text-xs text-amber-200/85">{schedulePlan.summary}</p>
          ) : (
            <ol className="mt-3 space-y-2 list-decimal list-inside text-xs">
              {schedulePlan.slots.map((s, idx) => (
                <li
                  key={`${s.role}-${s.dayIndex}-${idx}`}
                  className="rounded-md border border-slate-800/90 bg-slate-900/35 px-2 py-1.5"
                >
                  <span className="font-medium text-slate-100">
                    {idx + 1}. Day {s.dayIndex} · {s.role.replace(/_/g, " ")}
                  </span>
                  <span className={cn("ml-2 rounded border px-1 py-0.5 text-[9px] uppercase", confClass(s.confidence))}>
                    {s.confidence}
                  </span>
                  <p className="mt-0.5 text-slate-500">
                    Suggested:{" "}
                    <span className="text-slate-300 font-mono text-[10px]">
                      {s.suggestedScheduledAt ?? "—"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Platforms: {s.preferredPlatforms.length ? s.preferredPlatforms.join(", ") : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-4">{s.reason}</p>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-3 text-[11px] text-slate-500">{schedulePlan.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !campaignId || !schedulePlan.slots.length}
              onClick={() => void onApplySchedule(false)}
              className={cn(
                "rounded-md border border-cyan-900/50 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-100",
                "disabled:opacity-40 disabled:pointer-events-none hover:border-cyan-700"
              )}
            >
              Apply suggested schedule to drafts
            </button>
            <button
              type="button"
              disabled={busy || !campaignId || !schedulePlan.slots.length}
              onClick={() => void onApplySchedule(true)}
              className={cn(
                "rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100",
                "disabled:opacity-40 disabled:pointer-events-none hover:border-amber-700"
              )}
            >
              Apply + allow replacing existing schedules
            </button>
            <button
              type="button"
              disabled={busy || !campaignId || !schedulePlan.slots.length}
              onClick={() => void onGuidanceOnly()}
              className={cn(
                "rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200",
                "disabled:opacity-40 disabled:pointer-events-none hover:border-slate-500"
              )}
            >
              Keep as guidance only
            </button>
          </div>
          {!campaignId ? (
            <p className="mt-2 text-[11px] text-amber-200/80">Create or open a campaign (draft posts) to enable apply actions.</p>
          ) : null}
        </>
      )}

      {debug && schedulePlan?.diagnostics && applyStats && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] text-slate-400 space-y-1">
          <div>schedule slots: {schedulePlan.diagnostics.slotCount}</div>
          <div>exact ISO timestamps: {String(schedulePlan.diagnostics.usedExactIsoTimestamps)}</div>
          <div>timestamp interpretation: {schedulePlan.diagnostics.timestampInterpretation}</div>
          <div>timezone strategy: {schedulePlan.timezoneStrategy}</div>
          <div>
            posts matched to a schedule slot: {applyStats.dryRun.matchedCount}/{posts.length} (plan slots:{" "}
            {schedulePlan.slots.length})
          </div>
          <div>overwrite-protection rows (needs confirm): {applyStats.dryRun.overwriteProtectionCount}</div>
          <div>
            suggested schedule metadata rows (guidance dry-run): {applyStats.guidance.suggestedMetadataAttachedCount}
          </div>
          {lastApplyStats ? (
            <div>
              last action: {lastApplyStats.guidanceOnly ? "guidance" : "schedule"} · patches {lastApplyStats.patches} ·
              matched {lastApplyStats.matched}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
