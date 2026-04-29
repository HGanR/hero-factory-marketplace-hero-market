"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAiRevenueOsBentleyActions,
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import {
  derivePlatformRoleRouting,
  type RevenueOsPlatformRoleRoutingSummary,
} from "@/lib/revenue-os/platform-role-routing";
import { buildContentBatchCalendarSequence } from "@/lib/revenue-os/build-content-batch-calendar-sequence";
import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import { buildContentBatchRoutingForWorkflow } from "@/lib/revenue-os/bentley-content-batch-routing-chat";
import type { OptimizationMemoryGenerationSlice } from "@/lib/revenue-os/post-optimization-memory-types";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import {
  getFirstMissingField,
} from "@/lib/revenue-os/bentley-orchestrator";
import {
  buildBentleyMarketingProfile,
  summarizeBentleyMarketingProfileCompleteness,
} from "@/lib/revenue-os/bentley-marketing-profile";
import {
  buildDeploymentReadyPostDrafts,
  computeDeploymentReadiness,
} from "@/lib/revenue-os/bentley-deployment-orchestrator";
import { advanceBentleyPipelineStage } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";
import { buildSevenDayLaunchPlan } from "@/lib/revenue-os/build-seven-day-launch-plan";
import { ensureCampaignPostsFromBentleyOutputs } from "@/lib/revenue-os/ensure-campaign-posts-from-bentley";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import { getScheduledPublishReadiness } from "@/lib/social/scheduled-publish-readiness";
import type { ScheduledQueueSummaryJson } from "@/lib/revenue-os/bentley-scheduled-publish-chat";
import type { SocialPlatform } from "@/lib/social/config";
import { CampaignReviewerAssignmentAuditDebug } from "@/components/revenue-os/CampaignReviewerAssignmentAuditDebug";
import { CampaignReviewerAssignmentsPanel } from "@/components/revenue-os/CampaignReviewerAssignmentsPanel";
import { BentleyNotificationCenter } from "@/components/revenue-os/BentleyNotificationCenter";
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

function buildSharedProfile(
  p: ReturnType<typeof useAiRevenueOsProfile>,
  postingPlatforms: SocialPlatform[]
) {
  return {
    businessName: p.businessName,
    coreOffer: p.coreOffer,
    transformation: p.transformation,
    targetAudience: p.targetAudience,
    industry: p.effectiveIndustryLabel,
    postingPlatforms: postingPlatforms.map((x) => PLATFORM_LABELS[x] ?? x),
  };
}

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  accessSource?: "owner" | "assignment";
  viewerCampaignReviewerRole?: string;
};

export function BentleyDeploymentReadinessPanel() {
  useAiRevenueOsSnapshotSignature();
  const router = useRouter();
  const [debugScheduling, setDebugScheduling] = useState(false);
  useEffect(() => {
    setDebugScheduling(new URLSearchParams(window.location.search).get("airos_debug") === "1");
  }, []);

  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();

  const [scopeTick, setScopeTick] = useState(0);
  const [wf, setWf] = useState(loadWorkflowState);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [posts, setPosts] = useState<{ platform: string; utmParams?: Record<string, string> | null }[]>([]);
  const [viewerCanManageReviewerAssignments, setViewerCanManageReviewerAssignments] = useState(false);
  const [reviewerAssignmentsEnabled, setReviewerAssignmentsEnabled] = useState(true);
  const [campaignOwnerUserId, setCampaignOwnerUserId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [platformRoleRoutingSummary, setPlatformRoleRoutingSummary] =
    useState<RevenueOsPlatformRoleRoutingSummary | null>(null);
  const [optimizationMemGeneration, setOptimizationMemGeneration] =
    useState<OptimizationMemoryGenerationSlice | null>(null);

  const clientId = useMemo(() => {
    void scopeTick;
    return getBentleyStorageScope()?.clientId ?? "_";
  }, [scopeTick]);

  const { data: socialAccounts = [] } = useSocialAccounts(clientId);

  useEffect(() => {
    const onScope = () => setScopeTick((t) => t + 1);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    return () => window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
  }, []);

  useEffect(() => {
    const unsub = subscribeBentleyWorkflowCrossTab(() => setWf(loadWorkflowState()));
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const cid = clientId === "_" ? "" : clientId;
      try {
        const [pack, mem] = await Promise.all([
          fetchRevenueOsDeploymentFeedback(cid),
          fetchRevenueOsOptimizationMemory(cid),
        ]);
        if (cancelled) return;
        setPlatformRoleRoutingSummary(
          derivePlatformRoleRouting({
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
          })
        );
        setOptimizationMemGeneration(mem?.generation ?? null);
      } catch {
        if (!cancelled) {
          setPlatformRoleRoutingSummary(null);
          setOptimizationMemGeneration(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [clientId, scopeTick, systemSignals]);

  const shared = useMemo(() => buildSharedProfile(profile, postingPlatforms), [profile, postingPlatforms]);

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

  const batchRoutingSummary = useMemo(
    () =>
      buildContentBatchRoutingForWorkflow({
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        platformRoleRouting: platformRoleRoutingSummary,
        optimizationMemoryGeneration: optimizationMemGeneration,
      }),
    [wf.artifacts, launchPlan, platformRoleRoutingSummary, optimizationMemGeneration]
  );

  const batchCalendarSequence = useMemo(
    () =>
      buildContentBatchCalendarSequence({
        batchRouting: batchRoutingSummary,
        platformRoleRouting: platformRoleRoutingSummary,
        launchPlan,
        systemSignals,
      }),
    [batchRoutingSummary, platformRoleRoutingSummary, launchPlan, systemSignals]
  );

  const sequenceSchedulePlan = useMemo(() => {
    if (!batchCalendarSequence.slots.length) return null;
    return buildSequenceSchedulePlan({
      batchCalendarSequence,
      launchPlan,
      now: new Date(),
      userTimezoneHint: null,
    });
  }, [batchCalendarSequence, launchPlan]);

  const drafts = useMemo(
    () =>
      buildDeploymentReadyPostDrafts({
        sharedProfile: { postingPlatforms: shared.postingPlatforms },
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        systemSignals,
        platformRoleRoutingSummary,
        applyContentBatchMetadata: true,
        batchCalendarSequence: batchCalendarSequence.slots.length ? batchCalendarSequence : null,
        applySequenceMetadata: true,
        sequenceSchedulePlan: sequenceSchedulePlan?.slots.length ? sequenceSchedulePlan : null,
        applySequenceScheduleMetadata: true,
      }),
    [
      shared.postingPlatforms,
      wf.artifacts,
      launchPlan,
      systemSignals,
      platformRoleRoutingSummary,
      batchCalendarSequence,
      sequenceSchedulePlan,
    ]
  );

  const marketingProfile = useMemo(
    () =>
      buildBentleyMarketingProfile({
        bentleySnapshot: getBentleySnapshot(),
        sharedProfile: shared,
        authenticatedPostingPlatforms: postingPlatforms,
      }),
    [getBentleySnapshot, shared, postingPlatforms]
  );

  const completeness = useMemo(
    () => summarizeBentleyMarketingProfileCompleteness(marketingProfile),
    [marketingProfile]
  );

  const connectedSet = useMemo(() => connectedSocialPlatformsSet(socialAccounts), [socialAccounts]);

  const readiness = useMemo(
    () =>
      computeDeploymentReadiness({
        sharedProfile: { postingPlatforms: shared.postingPlatforms },
        campaignResult: wf.artifacts.campaign ?? undefined,
        contentEngineResult: wf.artifacts.contentEngine ?? undefined,
        mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
        launchPlan,
        systemSignals,
        socialAccounts,
        existingPosts: posts,
        platformRoleRoutingSummary,
        applyContentBatchMetadata: true,
        batchCalendarSequence: batchCalendarSequence.slots.length ? batchCalendarSequence : null,
        applySequenceMetadata: true,
        sequenceSchedulePlan: sequenceSchedulePlan?.slots.length ? sequenceSchedulePlan : null,
        applySequenceScheduleMetadata: true,
      }),
    [
      shared.postingPlatforms,
      wf.artifacts,
      launchPlan,
      systemSignals,
      socialAccounts,
      posts,
      platformRoleRoutingSummary,
      batchCalendarSequence,
      sequenceSchedulePlan,
    ]
  );

  const intakeComplete = getFirstMissingField(getBentleySnapshot()) === null;

  const handoff = useMemo(
    () =>
      advanceBentleyPipelineStage({
        intakeComplete,
        workflow: wf,
        deploymentDraftCount: drafts.length,
        connectedOauthPlatforms: connectedSet,
        targetOauthPlatforms: postingPlatforms,
      }),
    [intakeComplete, wf, drafts.length, connectedSet, postingPlatforms]
  );

  const schedAudit = useMemo(() => getScheduledPublishReadiness(), []);
  const [queueDiag, setQueueDiag] = useState<ScheduledQueueSummaryJson | null>(null);

  useEffect(() => {
    if (!debugScheduling) {
      setQueueDiag(null);
      return;
    }
    const qs = `?clientId=${encodeURIComponent(clientId)}`;
    void fetch(`/api/campaigns/scheduled-queue${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setQueueDiag(j as ScheduledQueueSummaryJson | null))
      .catch(() => setQueueDiag(null));
  }, [debugScheduling, clientId, scopeTick]);

  const loadCampaigns = useCallback(async () => {
    const qs = `?clientId=${encodeURIComponent(clientId)}`;
    try {
      const r = await fetch(`/api/campaigns${qs}`);
      if (!r.ok) return;
      const j = (await r.json()) as { campaigns?: CampaignRow[] };
      const list = Array.isArray(j.campaigns) ? j.campaigns : [];
      setCampaigns(list);
      setSelectedCampaignId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setCampaigns([]);
    }
  }, [clientId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const loadPosts = useCallback(async () => {
    if (!selectedCampaignId) {
      setPosts([]);
      setViewerCanManageReviewerAssignments(false);
      setReviewerAssignmentsEnabled(true);
      setCampaignOwnerUserId(null);
      return;
    }
    try {
      const r = await fetch(`/api/campaigns/${selectedCampaignId}`);
      if (!r.ok) {
        setPosts([]);
        setViewerCanManageReviewerAssignments(false);
        setReviewerAssignmentsEnabled(true);
        setCampaignOwnerUserId(null);
        return;
      }
      const j = (await r.json()) as {
        viewerCanManageReviewerAssignments?: boolean;
        ownerUserId?: number | null;
        posts?: { platform: string; utmParams?: Record<string, string> | null }[];
        governanceEntitlements?: { reviewerAssignmentsEnabled?: boolean };
      };
      setViewerCanManageReviewerAssignments(j.viewerCanManageReviewerAssignments === true);
      setReviewerAssignmentsEnabled(j.governanceEntitlements?.reviewerAssignmentsEnabled !== false);
      setCampaignOwnerUserId(
        typeof j.ownerUserId === "number" && j.ownerUserId > 0 ? j.ownerUserId : null
      );
      setPosts(Array.isArray(j.posts) ? j.posts : []);
    } catch {
      setPosts([]);
      setViewerCanManageReviewerAssignments(false);
      setReviewerAssignmentsEnabled(true);
      setCampaignOwnerUserId(null);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const goDashboardLaunch = useCallback(() => {
    router.push("/revenue-os/dashboard#campaign-launch");
  }, [router]);

  const onCreateDraftPosts = useCallback(async () => {
    if (!drafts.length) {
      toast.info("No deployment drafts yet — finish campaign or content generation first.");
      return;
    }
    setBusy(true);
    try {
      const res = await ensureCampaignPostsFromBentleyOutputs({
        clientId,
        existingCampaignId: selectedCampaignId,
        drafts,
      });
      if (res.campaignId && res.campaignId !== selectedCampaignId) {
        setSelectedCampaignId(res.campaignId);
      }
      await loadCampaigns();
      await loadPosts();
      if (res.ok) {
        toast.success(`Created ${res.created} draft post(s)${res.skipped ? ` (${res.skipped} already existed)` : ""}.`);
      } else {
        toast.error(res.errors[0] ?? "Some posts failed to create.");
      }
    } finally {
      setBusy(false);
    }
  }, [drafts, clientId, selectedCampaignId, loadCampaigns, loadPosts]);

  const badgeClass = readiness.isReady
    ? "border-emerald-500/55 bg-emerald-950/40 text-emerald-100"
    : "border-amber-500/50 bg-amber-950/35 text-amber-100";

  return (
    <section
      id="bentley-deployment-readiness"
      data-bentley-section="deployment-readiness"
      className="rounded-2xl border border-cyan-500/30 bg-slate-900/75 p-5 shadow-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-cyan-300/95 uppercase">
            Deployment readiness
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Move generated artifacts into <code className="text-cyan-200/90">campaign_posts</code> DRAFT rows.
            Nothing here auto-publishes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BentleyNotificationCenter />
          <span
            className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full border", badgeClass)}
            aria-live="polite"
          >
            {readiness.isReady ? "Ready to review queue" : "Action needed"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Marketing profile</p>
          <p className="text-xs text-slate-300">
            Completeness {completeness.score}/{completeness.max}
            {completeness.missing.length ? ` — missing: ${completeness.missing.slice(0, 3).join(", ")}` : ""}
          </p>
          <p className="text-xs text-slate-400">{handoff.headline}</p>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Connected accounts</p>
          <p className="text-xs text-slate-300">
            {socialAccounts.length
              ? socialAccounts.map((a) => a.platform).join(", ")
              : "None connected for this workspace."}
          </p>
          <p className="text-xs text-slate-500">
            OAuth targets: {postingPlatforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ") || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Blockers</p>
          {readiness.blockers.length ? (
            <ul className="text-xs text-amber-100/95 space-y-1 list-disc pl-4">
              {readiness.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No blocking items detected for manual publish.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Draft queue</p>
          <p className="text-sm text-slate-200">
            Generated drafts: <strong>{drafts.length}</strong>
          </p>
          <label className="block text-[11px] text-slate-500 mt-2 mb-1">Campaign for new rows</label>
          <select
            className="w-full text-xs bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-200"
            value={selectedCampaignId ?? ""}
            onChange={(e) => setSelectedCampaignId(e.target.value || null)}
          >
            <option value="">— Create / pick on first run —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.accessSource === "assignment" ? "Shared · " : ""}
                {c.name} ({c.status}
                {c.accessSource === "assignment" && c.viewerCampaignReviewerRole
                  ? ` · ${c.viewerCampaignReviewerRole}`
                  : ""}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <CampaignReviewerAssignmentsPanel
          campaignId={selectedCampaignId}
          canManage={viewerCanManageReviewerAssignments}
          reviewerAssignmentsEnabled={reviewerAssignmentsEnabled}
          ownerUserId={campaignOwnerUserId}
        />
        <CampaignReviewerAssignmentAuditDebug
          campaignId={selectedCampaignId}
          enabled={
            debugScheduling &&
            Boolean(selectedCampaignId) &&
            viewerCanManageReviewerAssignments &&
            reviewerAssignmentsEnabled
          }
        />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Per-platform readiness
        </p>
        <div className="flex flex-wrap gap-2">
          {drafts.map((d) => {
            const ok = connectedSet.has(d.platform as SocialPlatform);
            return (
              <span
                key={d.draftKey}
                className={cn(
                  "text-[11px] rounded-full border px-2.5 py-1 font-medium",
                  ok ? "border-emerald-500/45 text-emerald-100" : "border-slate-600 text-slate-400"
                )}
              >
                {PLATFORM_LABELS[d.platform as SocialPlatform] ?? d.platform}
                {ok ? " · connected" : " · connect"}
              </span>
            );
          })}
          {!drafts.length ? <span className="text-xs text-slate-500">No drafts until content/campaign exists.</span> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !drafts.length}
          onClick={() => void onCreateDraftPosts()}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-2"
        >
          Create Draft Posts
        </button>
        <button
          type="button"
          onClick={goDashboardLaunch}
          className="rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs font-medium px-3 py-2 text-slate-200"
        >
          Connect Accounts
        </button>
        <button
          type="button"
          onClick={goDashboardLaunch}
          className="rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs font-medium px-3 py-2 text-slate-200"
        >
          Review Draft Queue
        </button>
        <button
          type="button"
          onClick={goDashboardLaunch}
          className="rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs font-medium px-3 py-2 text-slate-200"
        >
          Prepare Schedule
        </button>
      </div>

      {debugScheduling ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-600 p-3 text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-400">Scheduled publish diagnostics (debug)</p>
          <p>supportsScheduling: {String(schedAudit.supportsScheduling)}</p>
          {queueDiag ? (
            <>
              <p className="text-slate-400 pt-1">
                Due + queued: sched {queueDiag.scheduledCount}, retry {queueDiag.retryScheduledCount}, publishing{" "}
                {queueDiag.publishingCount}, failed {queueDiag.failedCount}, published {queueDiag.postedCount}
              </p>
              {queueDiag.nextDue ? (
                <p>
                  Next: {queueDiag.nextDue.platform} @{" "}
                  {queueDiag.nextDue.at ? new Date(queueDiag.nextDue.at).toLocaleString() : "—"}
                </p>
              ) : (
                <p>No upcoming scheduled / retry rows in this workspace.</p>
              )}
            </>
          ) : (
            <p className="text-slate-600">Queue summary unavailable (sign in required).</p>
          )}
          <p className="text-slate-600 pt-1 border-t border-slate-700/80 mt-2 pt-2">
            Cron: POST /api/internal/scheduled-publish/run — header x-scheduled-publish-secret (env
            SCHEDULED_PUBLISH_WORKER_SECRET or CRON_SECRET). Last run summary is not persisted client-side.
          </p>
        </div>
      ) : null}
    </section>
  );
}
