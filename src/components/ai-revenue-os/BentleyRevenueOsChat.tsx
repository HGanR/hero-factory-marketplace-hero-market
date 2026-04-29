"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const FloatingNPCChat = dynamic(
  () => import("@/components/npc/FloatingNPCChat").then((m) => m.FloatingNPCChat),
  { ssr: false, loading: () => null }
);
import {
  applyAnswerForField,
  BENTLEY_INTRO_EXACT,
  getFirstMissingField,
  getGuidedMissingField,
  getWorkflowPhase,
  mergeBentleySnapshot,
  pipelineIntakeAuthoritative,
  sectionForField,
  sectionForPhaseHandoff,
} from "@/lib/revenue-os/bentley-orchestrator";
import {
  isDeploymentCenterIntent,
  isLaunchCampaignsIntent,
  isSevenDayLaunchPlanIntent,
  isStrategicDiagnosticIntent,
  isWhatsNextIntent,
  scrollToBentleySection,
} from "@/lib/revenue-os/bentley-scroll";
import {
  buildBentleyLocationAndNextSteps,
  buildFullBentleyTurnReply,
  buildOpeningContextSummary,
  formatRunHandoff,
} from "@/lib/revenue-os/bentley-section-readiness";
import {
  buildBentleyDashboardPayload,
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  clearDashboardUserTouchedForIncomingBentleyHandoff,
  hasMinimumFieldsForDashboard,
  hasMinimumFieldsForFullAnalysis,
  humanizeMissingFieldsForFullAnalysis,
  REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import {
  BENTLEY_OPEN_CHAT_EVENT,
  BENTLEY_RESUME_PIPELINE_EVENT,
  BENTLEY_RESUME_PIPELINE_QUERY,
  buildPipelineChatReply,
} from "@/lib/revenue-os/bentley-pipeline-progress";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { BentleyPipelineProgressStrip } from "./BentleyPipelineProgressStrip";
import {
  useAiRevenueOsBentleyActions,
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSnapshotSignature,
  useAiRevenueOsSystemSignals,
} from "./AiRevenueOsSharedState";
import { deriveSystemSignals } from "@/lib/revenue-os/derive-system-signals";
import { enrichSystemSignalsFromFeedback } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import { fetchRevenueOsDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-client-fetch";
import {
  buildBentleyInitialDiagnosticPreamble,
  buildBentleyStrategicGuidanceFromSignals,
  hasMaterialSystemSignals,
  shouldSuggestSevenDayLaunch,
} from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import {
  buildSevenDayLaunchPlan,
  formatBentleyLaunchPlanChatReply,
} from "@/lib/revenue-os/build-seven-day-launch-plan";
import {
  formatBentleyLaunchAnalyticsReply,
  formatBentleyLaunchProgressReply,
  parseLaunchAnalyticsIntent,
  parseLaunchProgressContinuityIntent,
} from "@/lib/revenue-os/launch-progress-bentley";
import {
  LAUNCH_CYCLE_PROGRESS_STORAGE_KEY,
  LAUNCH_PROGRESS_UPDATED_EVENT,
  loadLaunchCycleProgress,
} from "@/lib/revenue-os/launch-progress-storage";
import {
  fetchRemoteLaunchCycleState,
  getLaunchSyncScopeFromWindow,
  reconcileLaunchCycleProgress,
} from "@/lib/revenue-os/launch-progress-sync";
import {
  BENTLEY_SCOPE_DEFAULT_CLIENT,
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
  removeBentleySessionScopedAndLegacy,
  writeBentleySession,
} from "@/lib/revenue-os/bentley-storage-scope";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { writeCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import {
  formatBentleyLaunchDayExecutionReply,
  formatBentleyLaunchGeneralExecuteReply,
  parseLaunchExecutionIntent,
} from "@/lib/revenue-os/launch-day-bentley-intent";
import { scrollToAiRevenueOsAnchor } from "@/lib/revenue-os/revenue-os-anchor-scroll";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import {
  buildDeploymentReadyPostDrafts,
  computeDeploymentReadiness,
} from "@/lib/revenue-os/bentley-deployment-orchestrator";
import { advanceBentleyPipelineStage } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";
import {
  formatBentleyDeploymentReadinessReply,
  isDeploymentReadinessIntent,
} from "@/lib/revenue-os/bentley-deployment-chat";
import {
  formatBentleyScheduledQueueReply,
  isScheduledPublishQueueIntent,
  type ScheduledQueueSummaryJson,
} from "@/lib/revenue-os/bentley-scheduled-publish-chat";
import {
  BENTLEY_WORKER_LAST_RUN_SESSION_KEY,
  formatBentleyApprovalWorkerAnalyticsReply,
  isApprovalWorkerAnalyticsIntent,
} from "@/lib/revenue-os/bentley-approval-worker-analytics-chat";
import {
  formatBentleyDeploymentFeedbackReply,
  isDeploymentFeedbackIntent,
} from "@/lib/revenue-os/bentley-deployment-feedback-chat";
import {
  formatBentleyPlatformRoleRoutingReply,
  isPlatformRoleRoutingIntent,
} from "@/lib/revenue-os/bentley-platform-role-routing-chat";
import {
  buildContentBatchRoutingForWorkflow,
  formatBentleyContentBatchRoutingReply,
  isContentBatchRoutingIntent,
} from "@/lib/revenue-os/bentley-content-batch-routing-chat";
import {
  buildBatchCalendarSequencingForWorkflow,
  formatBentleyBatchCalendarSequencingReply,
  isBatchCalendarSequencingIntent,
} from "@/lib/revenue-os/bentley-batch-calendar-sequencing-chat";
import {
  buildSequenceSchedulePlanForChat,
  formatBentleySequenceScheduleReply,
  isSequenceScheduleIntent,
} from "@/lib/revenue-os/bentley-sequence-schedule-chat";
import {
  formatApproveAllRedirectReply,
  formatPublishApprovalIntelligenceReply,
  isApproveAllFromChatIntent,
  isPublishApprovalFocusIntent,
  BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY,
} from "@/lib/revenue-os/bentley-publish-approval-chat";
import {
  formatBentleyPublishWorkflowReviewReply,
  isPublishWorkflowReviewIntent,
} from "@/lib/revenue-os/bentley-publish-workflow-review-chat";
import { buildPublishWorkflowReview } from "@/lib/revenue-os/build-publish-workflow-review";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import {
  formatBentleyOptimizationMemoryReply,
  isOptimizationMemoryIntent,
} from "@/lib/revenue-os/bentley-optimization-memory-chat";
import { derivePlatformRoleRouting } from "@/lib/revenue-os/platform-role-routing";
import { fetchRevenueOsOptimizationMemory } from "@/lib/revenue-os/optimization-memory-client-fetch";
import type { LaunchCycleEventRecord } from "@/lib/revenue-os/launch-progress-db";
import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";
import type { SocialPlatform } from "@/lib/social/config";

const BENTLEY_NPC_ID = "ai-revenue-trends";

const OPEN_DASHBOARD = "Open Dashboard";
const OPEN_DASHBOARD_AND_RUN = "Open Dashboard and Run Full Analysis";
/** Plain labels — users don’t need to memorize “commands”. */
const WHATS_NEXT = "What's next?";
const VIDEO_UPLOAD_AND_LAUNCH = "Video upload & Launch";
const DEPLOYMENT_AND_SEQUENCES = "Deployment & sequences";
const RUN_REVENUE_OS_PIPELINE = "Run Revenue OS pipeline";
/** Same automation as the full pipeline — research/trends → assembled notes (crawl + artifacts) → generate campaign. */
const ENRICH_NOTES_AND_GENERATE_CAMPAIGN = "Enrich notes with industry research, then generate campaign";
const RESUME_PIPELINE = "Resume pipeline";
const GENERATE_SEVEN_DAY_LAUNCH = "Generate 7-Day Launch Plan";
const RESUME_LAUNCH = "Resume launch";
const WHAT_PATTERNS_WORKING = "What patterns are working?";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  x: "X",
};

function buildScheduledQueueUrlForBentley(clientId: string): string {
  const q = new URLSearchParams();
  q.set("clientId", clientId === "_" ? "" : clientId);
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1") {
        q.set("approvalSession", "1");
      }
      const wr = sessionStorage.getItem(BENTLEY_WORKER_LAST_RUN_SESSION_KEY);
      if (wr) q.set("workerLastRun", wr);
    } catch {
      /* ignore */
    }
  }
  return `/api/campaigns/scheduled-queue?${q.toString()}`;
}

function isRunPipelineMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t === RUN_REVENUE_OS_PIPELINE.toLowerCase()) return true;
  return /\brun (the )?full (revenue os|pipeline)\b/i.test(message.trim());
}

function isResumePipelineMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t === RESUME_PIPELINE.toLowerCase()) return true;
  return /\bresume (the )?pipeline\b/i.test(message.trim());
}

function isEnrichNotesThenCampaignMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t === ENRICH_NOTES_AND_GENERATE_CAMPAIGN.toLowerCase()) return true;
  return /\b(enrich|auto[- ]?fill).*\bnotes\b.*\b(generate|run)\b.*\bcampaign\b/i.test(t);
}

function isOpenDashboardOnlyMessage(message: string): boolean {
  const t = message.trim();
  if (t === OPEN_DASHBOARD) return true;
  const low = t.toLowerCase();
  return low === "open dashboard" || (low.startsWith("open dashboard") && !/(run|full analysis)/i.test(t));
}

function isOpenDashboardAndRunMessage(message: string): boolean {
  const t = message.trim();
  if (t === OPEN_DASHBOARD_AND_RUN) return true;
  const low = t.toLowerCase();
  return (
    /open dashboard (and|&) run (full )?analysis/i.test(low) ||
    /^run full analysis (on|from) dashboard$/i.test(t.trim())
  );
}

export function BentleyRevenueOsChat() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasSavedLaunchCycle, setHasSavedLaunchCycle] = useState(false);
  useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot, applyBentleyPatch, resetBentleyToFreshStart } = useAiRevenueOsBentleyActions();
  const [bentleyChatSurfaceKey, setBentleyChatSurfaceKey] = useState(0);
  const { systemSignals, setSystemSignals } = useAiRevenueOsSystemSignals();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();

  const sharedLaunchProfile = useMemo(
    () => ({
      businessName: profile.businessName,
      coreOffer: profile.coreOffer,
      transformation: profile.transformation,
      targetAudience: profile.targetAudience,
      industry: profile.effectiveIndustryLabel,
      postingPlatforms: postingPlatforms.map((p) => PLATFORM_LABELS[p] ?? p),
    }),
    [profile, postingPlatforms]
  );

  const runPipelineOrchestration = useCallback(async () => {
    const { resumePipeline } = await import("@/lib/revenue-os/bentley-pipeline-resume");
    const { getResolvedUserIdFromStorage } = await import("@/lib/revenue-os/bentley-user-session");
    return resumePipeline({
      getSnapshot: getBentleySnapshot,
      applyPatch: applyBentleyPatch,
      userId: getResolvedUserIdFromStorage(),
    });
  }, [getBentleySnapshot, applyBentleyPatch]);

  const applySignalsAfterSuccessfulPipeline = useCallback(() => {
    try {
      const wf = loadWorkflowState();
      const base = deriveSystemSignals({
        trends: wf.artifacts.trends ?? null,
        research: wf.artifacts.research ?? null,
        workflow: wf,
        snapshot: getBentleySnapshot(),
      });
      setSystemSignals(base);
      if (typeof window === "undefined") return;
      const cid = getBentleyStorageScope()?.clientId ?? "";
      void fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid).then((pack) => {
        if (!pack) return;
        setSystemSignals(enrichSystemSignalsFromFeedback(base, pack.signalsInput));
      });
    } catch {
      /* non-fatal */
    }
  }, [getBentleySnapshot, setSystemSignals]);

  useEffect(() => {
    const onResume = () => {
      void (async () => {
        const result = await runPipelineOrchestration();
        if (!result.ok) {
          if (result.status === "blocked") {
            toast.info(result.reason ?? "Pipeline busy");
          } else {
            toast.error(result.reason ?? "Pipeline stopped");
          }
          return;
        }
        applySignalsAfterSuccessfulPipeline();
        toast.success("Pipeline resumed");
      })();
    };
    window.addEventListener(BENTLEY_RESUME_PIPELINE_EVENT, onResume);
    return () => window.removeEventListener(BENTLEY_RESUME_PIPELINE_EVENT, onResume);
  }, [runPipelineOrchestration, applySignalsAfterSuccessfulPipeline]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncLaunchCycle = () =>
      setHasSavedLaunchCycle(loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY) != null);
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncLaunchCycle();
    });
    window.addEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, syncLaunchCycle);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, syncLaunchCycle);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, syncLaunchCycle);
      window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, syncLaunchCycle);
    };
  }, []);

  const onBentleyStartOver = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Start over with Bentley? This clears your intake, pipeline progress in this browser session, launch plan, and chat history."
    );
    if (!ok) return;
    resetBentleyToFreshStart();
    setBentleyChatSurfaceKey((k) => k + 1);
    toast.success("Bentley session reset — you can begin fresh.");
  }, [resetBentleyToFreshStart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(BENTLEY_RESUME_PIPELINE_QUERY) !== "1") return;
    const u = new URL(window.location.href);
    u.searchParams.delete(BENTLEY_RESUME_PIPELINE_QUERY);
    window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
    void (async () => {
      const result = await runPipelineOrchestration();
      if (!result.ok) {
        if (result.status === "blocked") {
          toast.info(result.reason ?? "Pipeline busy");
        } else {
          toast.error(result.reason ?? "Pipeline stopped");
        }
      } else {
        applySignalsAfterSuccessfulPipeline();
        toast.success("Pipeline resumed");
      }
    })();
  }, [runPipelineOrchestration, applySignalsAfterSuccessfulPipeline]);

  const postGreetingBuilder = useCallback(() => {
    const base = buildOpeningContextSummary(getBentleySnapshot(), {
      pathname,
      workflow: loadWorkflowState(),
    });
    const pre = buildBentleyInitialDiagnosticPreamble(systemSignals);
    if (!pre) return base;
    return `${pre}\n\n---\n\n${base}`;
  }, [getBentleySnapshot, pathname, systemSignals]);

  const snapSig = useAiRevenueOsSnapshotSignature();
  const initialGreeting = useMemo(() => {
    const s = getBentleySnapshot();
    return getGuidedMissingField(s) === null
      ? "I'm Bentley — your guided intake is saved. Ask what's next, open the dashboard, or run the pipeline from the shortcuts below."
      : BENTLEY_INTRO_EXACT;
  }, [snapSig, getBentleySnapshot]);

  const snapForPrompts = getBentleySnapshot();
  const intakeComplete =
    pipelineIntakeAuthoritative(snapForPrompts) || getGuidedMissingField(snapForPrompts) === null;
  const wf = loadWorkflowState();
  const canResumePipeline =
    intakeComplete &&
    (wf.lastFailedPhase != null || (Boolean(wf.completed.research) && !wf.completed.analysis));
  const quickPrompts = intakeComplete
    ? [
        WHATS_NEXT,
        ...(shouldSuggestSevenDayLaunch(systemSignals) ? [GENERATE_SEVEN_DAY_LAUNCH] : []),
        ...(hasSavedLaunchCycle ? [RESUME_LAUNCH] : []),
        RUN_REVENUE_OS_PIPELINE,
        WHAT_PATTERNS_WORKING,
        ENRICH_NOTES_AND_GENERATE_CAMPAIGN,
        ...(canResumePipeline ? [RESUME_PIPELINE] : []),
        VIDEO_UPLOAD_AND_LAUNCH,
        DEPLOYMENT_AND_SEQUENCES,
        OPEN_DASHBOARD,
        OPEN_DASHBOARD_AND_RUN,
      ]
    : [WHATS_NEXT];

  const onDashboard = Boolean(pathname?.includes("/revenue-os/dashboard"));

  const inputPlaceholder = intakeComplete
    ? onDashboard
      ? "Ask what’s next, e.g. where to upload video, or use the shortcuts…"
      : "Ask what’s next, or run the pipeline — shortcuts below."
    : "Answer Bentley’s prompts to fill this page…";

  const guidedHandler = useCallback(
    async (message: string) => {
      if (isSevenDayLaunchPlanIntent(message)) {
        const wf = loadWorkflowState();
        const plan = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wf.artifacts.trends ?? undefined,
          researchResult: wf.artifacts.research ?? undefined,
          workflowState: wf,
        });
        const debug =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        return {
          reply: formatBentleyLaunchPlanChatReply(plan, { includeFullPlan: debug }),
        };
      }

      if (parseLaunchProgressContinuityIntent(message)) {
        const wfProgress = loadWorkflowState();
        const planProgress = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wfProgress.artifacts.trends ?? undefined,
          researchResult: wfProgress.artifacts.research ?? undefined,
          workflowState: wfProgress,
        });
        const progress =
          typeof window !== "undefined" ? loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY) : null;
        const debugProgress =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        if (typeof window !== "undefined") {
          scrollToAiRevenueOsAnchor("seven-day-launch-mode");
        }
        return {
          reply: formatBentleyLaunchProgressReply({
            progress,
            plan: planProgress,
            sharedProfile: sharedLaunchProfile,
            debug: debugProgress,
          }),
        };
      }

      if (parseLaunchAnalyticsIntent(message)) {
        const wfAn = loadWorkflowState();
        const planAn = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wfAn.artifacts.trends ?? undefined,
          researchResult: wfAn.artifacts.research ?? undefined,
          workflowState: wfAn,
        });
        const localAn =
          typeof window !== "undefined" ? loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY) : null;
        let mergedAn = localAn;
        let historyProgresses: RevenueOsLaunchCycleProgress[] = [];
        let eventsAn: LaunchCycleEventRecord[] = [];
        if (typeof window !== "undefined") {
          const { scopeKey, clientId, trustId } = getLaunchSyncScopeFromWindow();
          const remotePack = await fetchRemoteLaunchCycleState(scopeKey, clientId, trustId, 5, 20);
          const reconciled = reconcileLaunchCycleProgress(localAn, remotePack.latest?.progress ?? null);
          mergedAn = reconciled.merged ?? localAn;
          historyProgresses = remotePack.recent.map((r) => r.progress);
          eventsAn = remotePack.events;
          scrollToAiRevenueOsAnchor("seven-day-launch-mode");
        }
        const debugAn =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        return {
          reply: formatBentleyLaunchAnalyticsReply({
            progress: mergedAn,
            plan: planAn,
            sharedProfile: sharedLaunchProfile,
            systemSignals,
            historyCycles: historyProgresses.length ? historyProgresses : mergedAn ? [mergedAn] : [],
            events: eventsAn,
            debug: debugAn,
          }),
        };
      }

      if (isApprovalWorkerAnalyticsIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugAw =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const r = await fetch(buildScheduledQueueUrlForBentley(cid));
          if (r.ok) {
            const q = (await r.json()) as ScheduledQueueSummaryJson;
            if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
              scrollToAiRevenueOsAnchor("bentley-approval-worker-analytics");
            }
            return {
              reply: formatBentleyApprovalWorkerAnalyticsReply({
                q,
                debug: debugAw,
              }),
            };
          }
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load worker analytics (sign in or open **AI Revenue OS**). Nothing was triggered automatically.",
        };
      }

      if (isScheduledPublishQueueIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        try {
          const r = await fetch(buildScheduledQueueUrlForBentley(cid));
          if (r.ok) {
            const q = (await r.json()) as ScheduledQueueSummaryJson;
            return { reply: formatBentleyScheduledQueueReply(q) };
          }
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load your scheduled queue (try signing in or opening **Launch Campaigns**). Nothing was triggered automatically.",
        };
      }

      if (isOptimizationMemoryIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugMem =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const memPack = await fetchRevenueOsOptimizationMemory(cid === "_" ? "" : cid);
          if (memPack) {
            if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
              scrollToAiRevenueOsAnchor("bentley-optimization-memory");
            }
            return {
              reply: formatBentleyOptimizationMemoryReply({
                summary: memPack.summary,
                entryCount: memPack.stats.entryCount,
                debug: debugMem,
              }),
            };
          }
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load optimization memory (sign in or open **AI Revenue OS**). Try **Rebuild from feedback** on Step 4 when you’re in workspace.",
        };
      }

      if (isContentBatchRoutingIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugCb =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const wfCb = loadWorkflowState();
          const planCb = buildSevenDayLaunchPlan({
            systemSignals,
            sharedProfile: sharedLaunchProfile,
            trendsResult: wfCb.artifacts.trends ?? undefined,
            researchResult: wfCb.artifacts.research ?? undefined,
            workflowState: wfCb,
          });
          const [packCb, memCb] = await Promise.all([
            fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid),
            fetchRevenueOsOptimizationMemory(cid === "_" ? "" : cid),
          ]);
          const routingCb = derivePlatformRoleRouting({
            deploymentRollup: packCb?.rollup ?? null,
            memorySummary: memCb?.summary ?? null,
            metricSyncContext: packCb?.metricSyncContext
              ? {
                  liveMetricPlatforms: packCb.metricSyncContext.liveMetricPlatforms,
                  stubPublishPlatforms: packCb.metricSyncContext.stubPublishPlatforms,
                }
              : null,
            signalsInput: packCb?.signalsInput ?? null,
            systemSignals,
          });
          const batchSummary = buildContentBatchRoutingForWorkflow({
            campaignResult: wfCb.artifacts.campaign ?? undefined,
            contentEngineResult: wfCb.artifacts.contentEngine ?? undefined,
            mediaBrief: wfCb.artifacts.mediaBriefText ?? undefined,
            launchPlan: planCb,
            platformRoleRouting: routingCb,
            optimizationMemoryGeneration: memCb?.generation ?? null,
          });
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-content-batch-routing");
          }
          return {
            reply: formatBentleyContentBatchRoutingReply({
              batchSummary,
              platformRoleRouting: routingCb,
              debug: debugCb,
            }),
          };
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load workflow or deployment data for content batches (sign in or open **AI Revenue OS**). Nothing was changed.",
        };
      }

      if (isSequenceScheduleIntent(message)) {
        const tSched = message.trim().toLowerCase();
        const cidSched = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugSched =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        if (/\bapply the schedule\b/.test(tSched)) {
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-sequence-schedule");
          }
          return {
            reply:
              "**Apply from the panel** — I don’t set `scheduledAt` from chat. Open **Step 4 → Sequence → schedule** and use **Apply suggested schedule to drafts** (with overwrite confirmation when needed).",
          };
        }
        try {
          const wfSched = loadWorkflowState();
          const planSched = buildSevenDayLaunchPlan({
            systemSignals,
            sharedProfile: sharedLaunchProfile,
            trendsResult: wfSched.artifacts.trends ?? undefined,
            researchResult: wfSched.artifacts.research ?? undefined,
            workflowState: wfSched,
          });
          const [packSched, memSched] = await Promise.all([
            fetchRevenueOsDeploymentFeedback(cidSched === "_" ? "" : cidSched),
            fetchRevenueOsOptimizationMemory(cidSched === "_" ? "" : cidSched),
          ]);
          const routingSched = derivePlatformRoleRouting({
            deploymentRollup: packSched?.rollup ?? null,
            memorySummary: memSched?.summary ?? null,
            metricSyncContext: packSched?.metricSyncContext
              ? {
                  liveMetricPlatforms: packSched.metricSyncContext.liveMetricPlatforms,
                  stubPublishPlatforms: packSched.metricSyncContext.stubPublishPlatforms,
                }
              : null,
            signalsInput: packSched?.signalsInput ?? null,
            systemSignals,
          });
          const sequenceSched = buildBatchCalendarSequencingForWorkflow({
            campaignResult: wfSched.artifacts.campaign ?? undefined,
            contentEngineResult: wfSched.artifacts.contentEngine ?? undefined,
            mediaBrief: wfSched.artifacts.mediaBriefText ?? undefined,
            launchPlan: planSched,
            platformRoleRouting: routingSched,
            optimizationMemoryGeneration: memSched?.generation ?? null,
            systemSignals,
          });
          const tzHint =
            typeof window !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
              : null;
          const schedulePlan = buildSequenceSchedulePlanForChat({
            batchCalendarSequence: sequenceSched,
            launchPlan: planSched,
            now: typeof window !== "undefined" ? new Date() : undefined,
            userTimezoneHint: tzHint,
          });
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-sequence-schedule");
          }
          return {
            reply: formatBentleySequenceScheduleReply({
              sequence: sequenceSched,
              schedulePlan,
              debug: debugSched,
            }),
          };
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load schedule data (sign in or open **AI Revenue OS**). Nothing was changed.",
        };
      }

      if (isPublishWorkflowReviewIntent(message) || isPublishApprovalFocusIntent(message)) {
        const tPub = message.trim().toLowerCase();
        const cidPub = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugPub =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        const workflowIntent = isPublishWorkflowReviewIntent(message);
        const approvalFocus = isPublishApprovalFocusIntent(message);

        if (isApproveAllFromChatIntent(message)) {
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-publish-workflow-review");
          }
          return { reply: formatApproveAllRedirectReply() };
        }

        if (/\bconfirm my schedule\b/.test(tPub)) {
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-publish-workflow-review");
          }
          return {
            reply:
              "**Confirm in the panel** — I don’t PATCH `scheduledAt` from chat. Open **Step 4 → Publish workflow review** and use **Apply suggested schedule** or **Accept non-conflicting**.",
          };
        }
        try {
          const wfPub = loadWorkflowState();
          const planPub = buildSevenDayLaunchPlan({
            systemSignals,
            sharedProfile: sharedLaunchProfile,
            trendsResult: wfPub.artifacts.trends ?? undefined,
            researchResult: wfPub.artifacts.research ?? undefined,
            workflowState: wfPub,
          });
          const [packPub, memPub] = await Promise.all([
            fetchRevenueOsDeploymentFeedback(cidPub === "_" ? "" : cidPub),
            fetchRevenueOsOptimizationMemory(cidPub === "_" ? "" : cidPub),
          ]);
          const routingPub = derivePlatformRoleRouting({
            deploymentRollup: packPub?.rollup ?? null,
            memorySummary: memPub?.summary ?? null,
            metricSyncContext: packPub?.metricSyncContext
              ? {
                  liveMetricPlatforms: packPub.metricSyncContext.liveMetricPlatforms,
                  stubPublishPlatforms: packPub.metricSyncContext.stubPublishPlatforms,
                }
              : null,
            signalsInput: packPub?.signalsInput ?? null,
            systemSignals,
          });
          const sequencePub = buildBatchCalendarSequencingForWorkflow({
            campaignResult: wfPub.artifacts.campaign ?? undefined,
            contentEngineResult: wfPub.artifacts.contentEngine ?? undefined,
            mediaBrief: wfPub.artifacts.mediaBriefText ?? undefined,
            launchPlan: planPub,
            platformRoleRouting: routingPub,
            optimizationMemoryGeneration: memPub?.generation ?? null,
            systemSignals,
          });
          const tzPub =
            typeof window !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
              : null;
          const schedulePlanPub = buildSequenceSchedulePlanForChat({
            batchCalendarSequence: sequencePub,
            launchPlan: planPub,
            now: typeof window !== "undefined" ? new Date() : undefined,
            userTimezoneHint: tzPub,
          });
          const qsc = cidPub === "_" ? "" : cidPub;
          const [campRes, accRes] = await Promise.all([
            fetch(`/api/campaigns?clientId=${encodeURIComponent(qsc)}`),
            fetch(`/api/social/accounts?clientId=${encodeURIComponent(qsc)}`),
          ]);
          let postsPayload: {
            id: string;
            platform: string;
            status: string;
            scheduledAt?: string | Date | null;
            caption?: string | null;
            utmParams?: Record<string, string> | null;
            postedAt?: string | Date | null;
            errorMessage?: string | null;
          }[] = [];
          let publishApprovalChainForReview = parseCampaignPublishApprovalChainJson(null);
          let campaignFirstId: string | null = null;
          if (campRes.ok) {
            const cj = (await campRes.json()) as { campaigns?: { id: string }[] };
            const firstId = cj.campaigns?.[0]?.id;
            if (firstId) {
              campaignFirstId = firstId;
              const pr = await fetch(`/api/campaigns/${firstId}`);
              if (pr.ok) {
                const pj = (await pr.json()) as {
                  posts?: typeof postsPayload;
                  publishApprovalChain?: unknown;
                };
                postsPayload = pj.posts ?? [];
                publishApprovalChainForReview = parseCampaignPublishApprovalChainJson(
                  pj.publishApprovalChain ?? null
                );
              }
            }
          }
          let accountsPayload: { platform: string; platformCanonical?: SocialPlatform | null }[] = [];
          if (accRes.ok) {
            const aj = (await accRes.json()) as { accounts?: typeof accountsPayload };
            accountsPayload = aj.accounts ?? [];
          }

          let wrEnvPub = false;
          try {
            const ar = await fetch("/api/revenue-os/publish-approval-settings");
            if (ar.ok) {
              const aj = (await ar.json()) as { workerRequiresApproval?: boolean };
              wrEnvPub = Boolean(aj.workerRequiresApproval);
            }
          } catch {
            wrEnvPub = false;
          }
          let uiApprovalPub = false;
          try {
            uiApprovalPub =
              typeof window !== "undefined" &&
              sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1";
          } catch {
            uiApprovalPub = false;
          }
          const effectiveApprovalPub = wrEnvPub || uiApprovalPub;

          const summary = buildPublishWorkflowReview({
            posts: postsPayload,
            schedulePlan: schedulePlanPub.slots.length ? schedulePlanPub : null,
            batchCalendarSequence: sequencePub.slots.length ? sequencePub : null,
            socialAccounts: accountsPayload,
            workerRequiresApproval: effectiveApprovalPub,
            publishApprovalChain: publishApprovalChainForReview,
          });
          if (
            typeof window !== "undefined" &&
            campaignFirstId &&
            effectiveApprovalPub
          ) {
            void fetch(`/api/campaigns/${campaignFirstId}/publish-approval-sla-scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workerRequiresApproval: effectiveApprovalPub }),
            }).catch(() => {});
          }
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-publish-workflow-review");
          }

          if (approvalFocus && !workflowIntent) {
            return {
              reply: formatPublishApprovalIntelligenceReply({
                summary,
                effectiveApprovalRequired: effectiveApprovalPub,
                userMessage: message,
                debug: debugPub,
              }),
            };
          }

          const baseReply = formatBentleyPublishWorkflowReviewReply({
            summary,
            debug: debugPub,
            effectiveApprovalRequired: effectiveApprovalPub,
          });

          if (approvalFocus && workflowIntent) {
            return {
              reply: `${baseReply}\n\n---\n\n${formatPublishApprovalIntelligenceReply({
                summary,
                effectiveApprovalRequired: effectiveApprovalPub,
                userMessage: message,
                debug: false,
              })}`,
            };
          }

          return { reply: baseReply };
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load publish workflow data (sign in or open **AI Revenue OS**). Nothing was changed.",
        };
      }

      if (isBatchCalendarSequencingIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugSeq =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const wfSeq = loadWorkflowState();
          const planSeq = buildSevenDayLaunchPlan({
            systemSignals,
            sharedProfile: sharedLaunchProfile,
            trendsResult: wfSeq.artifacts.trends ?? undefined,
            researchResult: wfSeq.artifacts.research ?? undefined,
            workflowState: wfSeq,
          });
          const [packSeq, memSeq] = await Promise.all([
            fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid),
            fetchRevenueOsOptimizationMemory(cid === "_" ? "" : cid),
          ]);
          const routingSeq = derivePlatformRoleRouting({
            deploymentRollup: packSeq?.rollup ?? null,
            memorySummary: memSeq?.summary ?? null,
            metricSyncContext: packSeq?.metricSyncContext
              ? {
                  liveMetricPlatforms: packSeq.metricSyncContext.liveMetricPlatforms,
                  stubPublishPlatforms: packSeq.metricSyncContext.stubPublishPlatforms,
                }
              : null,
            signalsInput: packSeq?.signalsInput ?? null,
            systemSignals,
          });
          const sequence = buildBatchCalendarSequencingForWorkflow({
            campaignResult: wfSeq.artifacts.campaign ?? undefined,
            contentEngineResult: wfSeq.artifacts.contentEngine ?? undefined,
            mediaBrief: wfSeq.artifacts.mediaBriefText ?? undefined,
            launchPlan: planSeq,
            platformRoleRouting: routingSeq,
            optimizationMemoryGeneration: memSeq?.generation ?? null,
            systemSignals,
          });
          if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
            scrollToAiRevenueOsAnchor("bentley-batch-calendar-sequencing");
          }
          return {
            reply: formatBentleyBatchCalendarSequencingReply({
              sequence,
              platformRoleRouting: routingSeq,
              debug: debugSeq,
            }),
          };
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load sequencing data (sign in or open **AI Revenue OS**). Nothing was changed.",
        };
      }

      if (isPlatformRoleRoutingIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugPr =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const [pack, memPack] = await Promise.all([
            fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid),
            fetchRevenueOsOptimizationMemory(cid === "_" ? "" : cid),
          ]);
          if (pack || memPack) {
            if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
              scrollToAiRevenueOsAnchor("bentley-platform-role-routing");
            }
            const routing = derivePlatformRoleRouting({
              deploymentRollup: pack?.rollup ?? null,
              memorySummary: memPack?.summary ?? null,
              metricSyncContext: pack?.metricSyncContext
                ? {
                    liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
                    stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
                  }
                : null,
              signalsInput: pack?.signalsInput ?? null,
              systemSignals,
            });
            return {
              reply: formatBentleyPlatformRoleRoutingReply({
                message,
                routing,
                metricSyncContext: pack?.metricSyncContext
                  ? {
                      liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
                      stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
                    }
                  : undefined,
                debug: debugPr,
                debugInputs: {
                  hadDeploymentRollup: Boolean(pack?.rollup),
                  hadMemorySummary: Boolean(memPack?.summary),
                  hadSignalsInput: Boolean(pack?.signalsInput),
                },
              }),
            };
          }
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load deployment or memory data for platform roles (sign in or open **AI Revenue OS**). Nothing was changed.",
        };
      }

      if (isDeploymentFeedbackIntent(message)) {
        const cid = typeof window !== "undefined" ? getBentleyStorageScope()?.clientId ?? "_" : "_";
        const debugFb =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("airos_debug") === "1";
        try {
          const pack = await fetchRevenueOsDeploymentFeedback(cid === "_" ? "" : cid);
          if (pack) {
            if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
              scrollToAiRevenueOsAnchor("bentley-deployment-feedback");
            }
            return {
              reply: formatBentleyDeploymentFeedbackReply({
                rollup: pack.rollup,
                latest: pack.latest,
                rowCount: pack.rowCount,
                systemSignalsEnriched: systemSignals.deploymentFeedbackEnriched === true,
                debug: debugFb,
                metricSyncContext: pack.metricSyncContext
                  ? {
                      liveMetricPlatforms: pack.metricSyncContext.liveMetricPlatforms,
                      stubPublishPlatforms: pack.metricSyncContext.stubPublishPlatforms,
                    }
                  : undefined,
              }),
            };
          }
        } catch {
          /* fall through */
        }
        return {
          reply:
            "I couldn’t load deployment feedback right now (sign in or open **Launch Campaigns** in your workspace). Nothing was changed.",
        };
      }

      if (isDeploymentReadinessIntent(message)) {
        const snapDr = getBentleySnapshot();
        const missingDr = getFirstMissingField(snapDr);
        const wfDr = loadWorkflowState();
        let socialAccountsDr: { platform: string; platformCanonical?: SocialPlatform | null }[] = [];
        if (typeof window !== "undefined") {
          const cid = getBentleyStorageScope()?.clientId ?? "_";
          try {
            const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(cid)}`);
            if (r.ok) {
              const j = (await r.json()) as {
                accounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
              };
              socialAccountsDr = j.accounts ?? [];
            }
          } catch {
            /* ignore */
          }
        }
        const planDr = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wfDr.artifacts.trends ?? undefined,
          researchResult: wfDr.artifacts.research ?? undefined,
          workflowState: wfDr,
        });
        const draftsDr = buildDeploymentReadyPostDrafts({
          sharedProfile: { postingPlatforms: sharedLaunchProfile.postingPlatforms },
          campaignResult: wfDr.artifacts.campaign ?? undefined,
          contentEngineResult: wfDr.artifacts.contentEngine ?? undefined,
          mediaBrief: wfDr.artifacts.mediaBriefText ?? undefined,
          launchPlan: planDr,
          systemSignals,
        });
        const readinessDr = computeDeploymentReadiness({
          sharedProfile: { postingPlatforms: sharedLaunchProfile.postingPlatforms },
          campaignResult: wfDr.artifacts.campaign ?? undefined,
          contentEngineResult: wfDr.artifacts.contentEngine ?? undefined,
          mediaBrief: wfDr.artifacts.mediaBriefText ?? undefined,
          launchPlan: planDr,
          systemSignals,
          socialAccounts: socialAccountsDr,
          existingPosts: undefined,
        });
        const handoffDr = advanceBentleyPipelineStage({
          intakeComplete: missingDr === null,
          workflow: wfDr,
          deploymentDraftCount: draftsDr.length,
          connectedOauthPlatforms: connectedSocialPlatformsSet(socialAccountsDr),
          targetOauthPlatforms: postingPlatforms,
        });
        if (typeof window !== "undefined" && pathname?.includes("/ai-revenue-os")) {
          scrollToAiRevenueOsAnchor("bentley-deployment-readiness");
        }
        return {
          reply: formatBentleyDeploymentReadinessReply({
            readiness: readinessDr,
            handoff: handoffDr,
            draftCount: draftsDr.length,
          }),
        };
      }

      const launchExec = parseLaunchExecutionIntent(message);
      if (launchExec.type === "general_execute") {
        if (typeof window !== "undefined") {
          scrollToAiRevenueOsAnchor("seven-day-launch-mode");
        }
        return { reply: formatBentleyLaunchGeneralExecuteReply() };
      }
      if (launchExec.type === "day") {
        const wfExec = loadWorkflowState();
        const planExec = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wfExec.artifacts.trends ?? undefined,
          researchResult: wfExec.artifacts.research ?? undefined,
          workflowState: wfExec,
        });
        const { reply, scrollTargetId } = formatBentleyLaunchDayExecutionReply({
          day: launchExec.day,
          launchPlan: planExec,
          sharedProfile: sharedLaunchProfile,
        });
        if (typeof window !== "undefined") {
          scrollToAiRevenueOsAnchor(scrollTargetId);
        }
        return { reply };
      }

      if (isStrategicDiagnosticIntent(message)) {
        const snap = getBentleySnapshot();
        const wf = loadWorkflowState();
        const missingDiag = getFirstMissingField(snap);
        let socialAccountsDiag: { platform: string; platformCanonical?: SocialPlatform | null }[] = [];
        if (typeof window !== "undefined") {
          const cid = getBentleyStorageScope()?.clientId ?? "_";
          try {
            const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(cid)}`);
            if (r.ok) {
              const j = (await r.json()) as {
                accounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
              };
              socialAccountsDiag = j.accounts ?? [];
            }
          } catch {
            /* ignore */
          }
        }
        const planDiag = buildSevenDayLaunchPlan({
          systemSignals,
          sharedProfile: sharedLaunchProfile,
          trendsResult: wf.artifacts.trends ?? undefined,
          researchResult: wf.artifacts.research ?? undefined,
          workflowState: wf,
        });
        const draftsDiag = buildDeploymentReadyPostDrafts({
          sharedProfile: { postingPlatforms: sharedLaunchProfile.postingPlatforms },
          campaignResult: wf.artifacts.campaign ?? undefined,
          contentEngineResult: wf.artifacts.contentEngine ?? undefined,
          mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
          launchPlan: planDiag,
          systemSignals,
        });
        const readinessDiag = computeDeploymentReadiness({
          sharedProfile: { postingPlatforms: sharedLaunchProfile.postingPlatforms },
          campaignResult: wf.artifacts.campaign ?? undefined,
          contentEngineResult: wf.artifacts.contentEngine ?? undefined,
          mediaBrief: wf.artifacts.mediaBriefText ?? undefined,
          launchPlan: planDiag,
          systemSignals,
          socialAccounts: socialAccountsDiag,
          existingPosts: undefined,
        });
        const handoffDiag = advanceBentleyPipelineStage({
          intakeComplete: missingDiag === null,
          workflow: wf,
          deploymentDraftCount: draftsDiag.length,
          connectedOauthPlatforms: connectedSocialPlatformsSet(socialAccountsDiag),
          targetOauthPlatforms: postingPlatforms,
        });
        const loc = buildBentleyLocationAndNextSteps({
          pathname,
          snapshot: snap,
          workflow: wf,
          deploymentHandoff: missingDiag ? null : handoffDiag,
        });
        let deploymentTail = "";
        if (!missingDiag) {
          if (isWhatsNextIntent(message)) {
            deploymentTail = `\n\n---\n\n${formatBentleyDeploymentReadinessReply({
              readiness: readinessDiag,
              handoff: handoffDiag,
              draftCount: draftsDiag.length,
            })}`;
          } else {
            deploymentTail = `\n\n---\n\n**Posting / deployment:** ${handoffDiag.headline}\n**Next:** ${handoffDiag.nextActions[0] ?? "Open Step 4 deployment readiness or Launch Campaigns on the dashboard."}`;
          }
        }
        if (hasMaterialSystemSignals(systemSignals)) {
          const debug =
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("airos_debug") === "1";
          const strat = buildBentleyStrategicGuidanceFromSignals(systemSignals, {
            includeNumericDebug: debug,
          });
          return { reply: `${strat}\n\n---\n\n${loc}${deploymentTail}` };
        }
        return { reply: `${loc}${deploymentTail}` };
      }

      if (isLaunchCampaignsIntent(message)) {
        scrollToBentleySection("launch-campaigns", { router });
        return {
          reply: onDashboard
            ? "Scrolling to **Launch Campaigns** — use **Section 1 · Video** for your upload. Align **Connected Accounts** with your posting platforms; if OAuth is missing, post manually using your compiled brief."
            : "Opening the **Revenue OS Dashboard** to **Launch Campaigns** — use **Section 1 · Video** after your video is ready.",
        };
      }
      if (isDeploymentCenterIntent(message)) {
        scrollToBentleySection("deployment-center", { router });
        return {
          reply: onDashboard
            ? "Scrolling to **Deployment Center** (Module 3) — check sequences, funnel runs, and anything blocking deployment."
            : "Opening the **Revenue OS Dashboard** to **Deployment Center** (Module 3) at the bottom of the page.",
        };
      }

      const snap = getBentleySnapshot();
      const phaseBefore = getWorkflowPhase(snap);
      const missing = getGuidedMissingField(snap);

      if (!missing) {
        if (
          isRunPipelineMessage(message) ||
          isResumePipelineMessage(message) ||
          isEnrichNotesThenCampaignMessage(message)
        ) {
          const result = await runPipelineOrchestration();
          if (!result.ok) {
            return {
              reply: `The automated pipeline stopped: **${result.reason ?? "Unknown error"}**\n\n**Resume:** tap **Resume pipeline** after fixing inputs — Bentley will continue from the first incomplete step (completed steps stay saved).`,
            };
          }
          applySignalsAfterSuccessfulPipeline();
          const milestones = result.milestones ?? [];
          return {
            reply: buildPipelineChatReply(milestones),
          };
        }

        const wantsRun = isOpenDashboardAndRunMessage(message);
        const wantsOpen = isOpenDashboardOnlyMessage(message);

        if (wantsRun || wantsOpen) {
          const autoRun = wantsRun;
          const payload = buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: autoRun });

          if (!hasMinimumFieldsForDashboard(payload)) {
            return {
              reply:
                "I can open the dashboard, but I still need a clearer **business name** and **industry** before it’s useful.",
            };
          }

          if (autoRun) {
            const check = hasMinimumFieldsForFullAnalysis(payload);
            if (!check.ok) {
              const human = humanizeMissingFieldsForFullAnalysis(check.missing);
              return {
                reply: `I can open the dashboard, but **Run Full Analysis** needs these numbers on the Revenue OS page first (under revenue / unit economics):\n\n${human.slice(0, 8).map((x) => `• ${x}`).join("\n")}${human.length > 8 ? "\n• …" : ""}\n\nTell me each value here and I’ll record it, or fill **Traffic**, **Conversion %**, and **AOV** in the guided flow — I’ll map them into the dashboard handoff.`,
              };
            }
          }

          try {
            removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
            clearDashboardUserTouchedForIncomingBentleyHandoff();
            writeBentleySession(
              BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
              serializeBentleyDashboardHandoff({ payload })
            );
            bentleyContinuityLog("intake_saved", {
              destination: "dashboard",
              autoRun,
              businessName: payload.businessName,
            });
            try {
              writeCanonicalBentleySnapshot(getBentleySnapshot());
            } catch {
              // ignore
            }
          } catch {
            // ignore storage failures
          }

          const reply = autoRun
            ? "I’ve prepared your dashboard.\n\nI’m opening Revenue OS Dashboard now. Your numbers are in place — running Full Analysis next."
            : "I’ve prepared your dashboard.\n\nI’m opening Revenue OS Dashboard now. Tap **Run Analysis** when you’re ready.";

          window.setTimeout(() => {
            const q = new URLSearchParams();
            const scope = getBentleyStorageScope();
            const cid = scope?.clientId?.trim();
            if (cid && cid !== BENTLEY_SCOPE_DEFAULT_CLIENT) q.set("clientId", cid);
            const qs = q.toString();
            router.push(qs ? `/revenue-os/dashboard?${qs}` : "/revenue-os/dashboard");
          }, 280);

          return { reply };
        }

        return { reply: formatRunHandoff(snap) };
      }

      const applied = applyAnswerForField(missing, message);
      if ("error" in applied) {
        return { reply: applied.error };
      }

      applyBentleyPatch(applied.patch, applied.questionnairePatch);
      const merged = mergeBentleySnapshot(snap, applied);
      const phaseAfter = getWorkflowPhase(merged);
      const nextMissing = getGuidedMissingField(merged);

      const reply = buildFullBentleyTurnReply(
        applied.confirm,
        phaseBefore,
        phaseAfter,
        nextMissing,
        merged
      );

      window.requestAnimationFrame(() => {
        if (phaseBefore !== phaseAfter) {
          scrollToBentleySection(sectionForPhaseHandoff(phaseAfter), { router });
        } else if (nextMissing) {
          scrollToBentleySection(sectionForField(nextMissing), { router });
        }
      });

      return { reply };
    },
    [
      getBentleySnapshot,
      applyBentleyPatch,
      router,
      runPipelineOrchestration,
      onDashboard,
      pathname,
      applySignalsAfterSuccessfulPipeline,
      systemSignals,
      sharedLaunchProfile,
      postingPlatforms,
    ]
  );

  return (
    <FloatingNPCChat
      key={bentleyChatSurfaceKey}
      npcId={BENTLEY_NPC_ID}
      floatingTriggerPreset="reality_neon"
      panelTitle="Bentley · AI Revenue OS"
      bubbleLabel="Chat with Bentley"
      bubbleAriaLabel="Open Bentley — guided AI Revenue OS assistant"
      avatarSrc="/npc/bentley-avatar.png"
      avatarAlt="Bentley — AI Revenue OS assistant"
      inputPlaceholder={inputPlaceholder}
      initialGreeting={initialGreeting}
      quickPrompts={quickPrompts}
      highlightAfterIdleMs={45000}
      guidedHandler={guidedHandler}
      postGreetingBuilder={postGreetingBuilder}
      panelTopSlot={
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onBentleyStartOver}
              className="rounded-lg border border-slate-600/80 bg-slate-950/50 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-cyan-500/40 hover:bg-slate-900/80 hover:text-cyan-100"
            >
              Start over
            </button>
          </div>
          <BentleyPipelineProgressStrip />
        </div>
      }
      externalOpenEventName={BENTLEY_OPEN_CHAT_EVENT}
      className="border-cyan-500/35 shadow-[0_8px_40px_rgba(0,209,255,0.12)]"
    />
  );
}
