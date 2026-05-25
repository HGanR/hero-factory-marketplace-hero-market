"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SocialPlatform } from "@/lib/social/config";
import {
  useAiRevenueOsContentCampaign,
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  buildSevenDayLaunchPlan,
  computeLaunchModeReadiness,
  formatSevenDayLaunchPlanPlain,
} from "@/lib/revenue-os/build-seven-day-launch-plan";
import type { RevenueOsLaunchDayPlan, RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  shouldSuggestSevenDayLaunch,
  systemSignalsMaterialKey,
} from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import { decideStringPrefill } from "@/lib/revenue-os/launch-prefill-decisions";
import {
  mapLaunchDayToActions,
  summarizeLaunchDayActionsForDebug,
  type RevenueOsLaunchAction,
} from "@/lib/revenue-os/map-launch-day-to-actions";
import { scrollToAiRevenueOsAnchor } from "@/lib/revenue-os/revenue-os-anchor-scroll";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import {
  LAUNCH_CYCLE_PROGRESS_STORAGE_KEY,
  LAUNCH_PROGRESS_UPDATED_EVENT,
  clearLaunchCycleProgress,
  createLaunchCycleProgress,
  loadLaunchCycleProgress,
  saveLaunchCycleProgress,
} from "@/lib/revenue-os/launch-progress-storage";
import {
  markLaunchDayActionCompleted,
  resetLaunchDay,
  setLaunchDayNotes,
  setLaunchDayStatus,
} from "@/lib/revenue-os/launch-progress-actions";
import type { RevenueOsLaunchDayExecutionStatus } from "@/lib/revenue-os/launch-progress-types";
import { diffLaunchProgressAgainstCurrent } from "@/lib/revenue-os/launch-progress-diff";
import { BENTLEY_STORAGE_SCOPE_CHANGED_EVENT } from "@/lib/revenue-os/bentley-storage-scope";
import {
  fetchRemoteLaunchCycleState,
  getLaunchSyncScopeFromWindow,
  isServerBackedLaunchProgress,
  launchProgressesMateriallyEqual,
  launchProgressMaterialFingerprint,
  patchLaunchCycleProgress,
  postLaunchCycleCreate,
  reconcileLaunchCycleProgress,
} from "@/lib/revenue-os/launch-progress-sync";
import {
  peekLaunchSyncClientDebug,
  recordLaunchSyncClientDebug,
} from "@/lib/revenue-os/launch-progress-sync-client-debug";
import { summarizeLaunchCycleAnalytics } from "@/lib/revenue-os/launch-analytics-summary";
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

function stableActionId(action: RevenueOsLaunchAction): string {
  if (action.kind === "scroll_to") return `scroll:${action.targetId}`;
  if (action.kind === "prefill_campaign_notes") return `prefill_notes:${action.label.slice(0, 48)}`;
  if (action.kind === "prefill_content_context") return "prefill_context";
  return `${action.kind}:${action.label.slice(0, 48)}`;
}

type PendingReplace =
  | { field: "campaignNotes"; proposed: string }
  | { field: "targetAudience"; proposed: string }
  | { field: "coreOffer"; proposed: string }
  | { field: "transformation"; proposed: string }
  | { field: "tone"; proposed: string };

function statusBadgeClass(s: RevenueOsLaunchDayExecutionStatus): string {
  switch (s) {
    case "completed":
      return "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40";
    case "in_progress":
      return "bg-cyan-500/15 text-cyan-200 ring-cyan-500/35";
    case "blocked":
      return "bg-rose-500/15 text-rose-200 ring-rose-500/35";
    default:
      return "bg-slate-700/50 text-slate-400 ring-slate-600/50";
  }
}

function LaunchActionRow(props: {
  action: RevenueOsLaunchAction;
  onScroll: (id: string) => void;
  onPrefillNotes: (value: string) => void;
  onPrefillContext: (payload: Record<string, unknown>) => void;
  onSuggestPick: (label: string) => void;
  onActionInvoked: (actionId: string) => void;
}) {
  const { action, onScroll, onPrefillNotes, onPrefillContext, onSuggestPick, onActionInvoked } = props;
  const id = stableActionId(action);

  if (action.kind === "scroll_to") {
    return (
      <button
        type="button"
        onClick={() => {
          onActionInvoked(id);
          onScroll(action.targetId);
        }}
        className="rounded-lg border border-cyan-600/50 bg-slate-800/90 px-3 py-1.5 text-left text-xs font-medium text-cyan-200 hover:bg-slate-800 transition-colors"
      >
        {action.label}
      </button>
    );
  }
  if (action.kind === "prefill_campaign_notes") {
    return (
      <button
        type="button"
        onClick={() => {
          onActionInvoked(id);
          onPrefillNotes(action.value);
        }}
        className="rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-1.5 text-left text-xs font-medium text-amber-100 hover:border-amber-400/60 transition-colors"
      >
        {action.label}
      </button>
    );
  }
  if (action.kind === "prefill_content_context") {
    return (
      <button
        type="button"
        onClick={() => {
          onActionInvoked(id);
          onPrefillContext(action.payload);
        }}
        className="rounded-lg border border-violet-500/35 bg-violet-950/20 px-3 py-1.5 text-left text-xs font-medium text-violet-100 hover:border-violet-400/50 transition-colors"
      >
        {action.label}
      </button>
    );
  }
  if (
    action.kind === "suggest_generate_content" ||
    action.kind === "suggest_generate_campaign" ||
    action.kind === "suggest_compile_media_brief" ||
    action.kind === "suggest_batch_variations" ||
    action.kind === "suggest_queue_review"
  ) {
    return (
      <button
        type="button"
        onClick={() => {
          onActionInvoked(id);
          onSuggestPick(action.label);
        }}
        className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-1.5 text-left text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
      >
        {action.label}
      </button>
    );
  }
  return null;
}

export function SevenDayLaunchModePanel() {
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const { isProviderActive, systemSignals } = useAiRevenueOsSystemSignals();
  const { campaignNotes, setCampaignNotes, tone, setTone } = useAiRevenueOsContentCampaign();
  const [plan, setPlan] = useState<RevenueOsLaunchModePlan | null>(null);
  const [cycleProgress, setCycleProgress] = useState<ReturnType<typeof loadLaunchCycleProgress>>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  const [highlightSuggest, setHighlightSuggest] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  type SyncUi = "idle" | "local" | "synced" | "error" | "syncing";
  const [syncUi, setSyncUi] = useState<SyncUi>("idle");
  const remoteHydrateSuppressedRef = useRef(false);
  const lastPushedFingerprintRef = useRef<string>("");
  const pushDebounceRef = useRef<number>(0);
  const planRef = useRef<RevenueOsLaunchModePlan | null>(null);

  const reloadProgress = useCallback(() => {
    setCycleProgress(loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowDebug(new URLSearchParams(window.location.search).get("airos_debug") === "1");
  }, []);

  useEffect(() => {
    reloadProgress();
    const onUp = () => reloadProgress();
    window.addEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, onUp);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onUp);
    return () => {
      window.removeEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, onUp);
      window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onUp);
    };
  }, [reloadProgress]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const sharedProfile = useMemo(() => buildSharedProfile(profile, postingPlatforms), [profile, postingPlatforms]);

  const readinessLive = useMemo(
    () => computeLaunchModeReadiness(systemSignals, sharedProfile),
    [systemSignals, sharedProfile]
  );

  const suggestLaunch = shouldSuggestSevenDayLaunch(systemSignals);

  const buildPlanNow = useCallback((): RevenueOsLaunchModePlan => {
    const wf = loadWorkflowState();
    return buildSevenDayLaunchPlan({
      systemSignals,
      sharedProfile,
      trendsResult: wf.artifacts.trends ?? undefined,
      researchResult: wf.artifacts.research ?? undefined,
      workflowState: wf,
    });
  }, [systemSignals, sharedProfile]);

  const pushRemote = useCallback(
    async (progress: RevenueOsLaunchCycleProgress, planOverride?: RevenueOsLaunchModePlan | null) => {
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        if (!me.ok) {
          setSyncUi("local");
          return;
        }
        const { scopeKey, clientId, trustId } = getLaunchSyncScopeFromWindow();
        const fp = launchProgressMaterialFingerprint(progress);
        if (fp === lastPushedFingerprintRef.current) return;

        const planSnap = planOverride ?? planRef.current;
        if (isServerBackedLaunchProgress(progress)) {
          const r = await patchLaunchCycleProgress(scopeKey, clientId, trustId, progress, {
            plan: planSnap ?? undefined,
            signalsSnapshot: systemSignals,
          });
          if (r.ok && r.bundle) {
            lastPushedFingerprintRef.current = launchProgressMaterialFingerprint(r.bundle.progress);
            saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, r.bundle.progress);
            setCycleProgress(r.bundle.progress);
            setSyncUi("synced");
          } else if (r.status === 401) {
            setSyncUi("local");
          } else {
            setSyncUi("error");
          }
        } else {
          const r = await postLaunchCycleCreate(scopeKey, clientId, trustId, {
            progress,
            plan: planSnap ?? undefined,
            signalsSnapshot: systemSignals,
          });
          if (r.ok && r.bundle) {
            lastPushedFingerprintRef.current = launchProgressMaterialFingerprint(r.bundle.progress);
            saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, r.bundle.progress);
            setCycleProgress(r.bundle.progress);
            setSyncUi("synced");
          } else if (r.status === 401) {
            setSyncUi("local");
          } else {
            setSyncUi("error");
          }
        }
      } catch {
        setSyncUi("error");
      }
    },
    [systemSignals]
  );

  const schedulePushRemote = useCallback(
    (progress: RevenueOsLaunchCycleProgress, planOverride?: RevenueOsLaunchModePlan | null) => {
      if (pushDebounceRef.current) window.clearTimeout(pushDebounceRef.current);
      pushDebounceRef.current = window.setTimeout(() => {
        pushDebounceRef.current = 0;
        void pushRemote(progress, planOverride);
      }, 650);
    },
    [pushRemote]
  );

  const runLaunchBackendSync = useCallback(async () => {
    if (typeof window === "undefined") return;
    setSyncUi("syncing");
    try {
      const me = await fetch("/api/auth/me", { credentials: "include" });
      if (!me.ok) {
        setSyncUi("local");
        recordLaunchSyncClientDebug({
          localVsRemote: "unauthenticated",
          syncDirection: "none",
          lastSyncAt: new Date().toISOString(),
          conflict: "skip",
        });
        return;
      }

      const local = loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY);
      if (remoteHydrateSuppressedRef.current && !local) {
        setSyncUi("local");
        recordLaunchSyncClientDebug({
          localVsRemote: "empty_after_new_cycle",
          syncDirection: "skipped",
          lastSyncAt: new Date().toISOString(),
          conflict: "suppress_remote_hydrate",
        });
        return;
      }
      if (local && remoteHydrateSuppressedRef.current) {
        remoteHydrateSuppressedRef.current = false;
      }

      const { scopeKey, clientId, trustId } = getLaunchSyncScopeFromWindow();
      const remote = await fetchRemoteLaunchCycleState(scopeKey, clientId, trustId);
      if (!remote.ok) {
        setSyncUi(remote.status === 401 ? "local" : "error");
        recordLaunchSyncClientDebug({
          localVsRemote: `fetch_${remote.status}`,
          syncDirection: "none",
          lastSyncAt: new Date().toISOString(),
          conflict: "remote_fetch_failed",
        });
        return;
      }

      const { merged, winner, shouldPushLocalToRemote } = reconcileLaunchCycleProgress(
        local,
        remote.latest?.progress ?? null
      );

      if (merged) {
        if (!local || !launchProgressesMateriallyEqual(local, merged)) {
          saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, merged, { silent: true });
          setCycleProgress(merged);
        }
        if (remote.latest?.plan && !planRef.current) {
          setPlan(remote.latest.plan);
        }
      }

      if (shouldPushLocalToRemote && merged) {
        schedulePushRemote(merged, planRef.current);
      }

      setSyncUi("synced");
      recordLaunchSyncClientDebug({
        localVsRemote: `local:${Boolean(local)} remote:${Boolean(remote.latest)}`,
        syncDirection: winner,
        lastSyncAt: new Date().toISOString(),
        conflict: shouldPushLocalToRemote ? "queued_local_push" : "none",
        analyticsLine: merged ? JSON.stringify(summarizeLaunchCycleAnalytics(merged)) : undefined,
      });
    } catch {
      setSyncUi("error");
    }
  }, [schedulePushRemote]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = 0;
      void runLaunchBackendSync();
    });
    const onScope = () => void runLaunchBackendSync();
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    };
  }, [runLaunchBackendSync]);

  useEffect(() => {
    if (!cycleProgress || plan) return;
    setPlan(buildPlanNow());
  }, [cycleProgress, plan, buildPlanNow]);

  useEffect(() => {
    if (!cycleProgress) return;
    setFocusedDay(cycleProgress.currentDay);
  }, [cycleProgress?.currentDay, cycleProgress?.cycleId]);

  const mutateProgress = useCallback(
    (fn: (p: NonNullable<typeof cycleProgress>) => NonNullable<typeof cycleProgress>, opts?: { silent?: boolean }) => {
      setCycleProgress((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, next, { silent: opts?.silent });
        queueMicrotask(() => schedulePushRemote(next, planRef.current));
        return next;
      });
    },
    [schedulePushRemote]
  );

  const runGenerateOrRefresh = useCallback(() => {
    const p = buildPlanNow();
    setPlan(p);
    if (!cycleProgress) {
      const prog = createLaunchCycleProgress(p, { systemSignals, sharedProfile });
      saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, prog);
      setCycleProgress(prog);
      setFocusedDay(prog.currentDay);
      queueMicrotask(() => schedulePushRemote(prog, p));
      return;
    }
    const merged = {
      ...cycleProgress,
      launchPlanSummary: p.summary,
      updatedAt: new Date().toISOString(),
      readinessAtCreation: {
        isReady: p.readiness.isReady,
        blockerCount: p.readiness.blockers.length,
      },
      trackingSnapshot: {
        signalMaterialKey: systemSignalsMaterialKey(systemSignals),
        coreOfferNorm: coerceTrimmedString(sharedProfile.coreOffer).replace(/\s+/g, " ").slice(0, 240),
        audienceNorm: coerceTrimmedString(sharedProfile.targetAudience).replace(/\s+/g, " ").slice(0, 240),
      },
    };
    saveLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, merged);
    setCycleProgress(merged);
    queueMicrotask(() => schedulePushRemote(merged, p));
  }, [buildPlanNow, cycleProgress, systemSignals, sharedProfile, schedulePushRemote]);

  const startNewCycle = useCallback(() => {
    remoteHydrateSuppressedRef.current = true;
    lastPushedFingerprintRef.current = "";
    clearLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY);
    setCycleProgress(null);
    setPlan(null);
    setFocusedDay(null);
    setSyncUi("local");
  }, []);

  const resumeLaunch = useCallback(() => {
    if (!cycleProgress) return;
    scrollToAiRevenueOsAnchor("seven-day-launch-mode");
    setFocusedDay(cycleProgress.currentDay);
  }, [cycleProgress]);

  const recordAction = useCallback(
    (day: number, actionId: string) => {
      if (day < 1 || day > 7) return;
      mutateProgress((p) => markLaunchDayActionCompleted(p, day as 1 | 2 | 3 | 4 | 5 | 6 | 7, actionId));
    },
    [mutateProgress]
  );

  const onCopy = useCallback(async () => {
    if (!plan) return;
    const text = formatSevenDayLaunchPlanPlain(plan);
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [plan]);

  const handleScroll = useCallback((targetId: string) => {
    scrollToAiRevenueOsAnchor(targetId);
  }, []);

  const applyCampaignNotes = useCallback(
    (value: string) => {
      const d = decideStringPrefill(campaignNotes, value);
      if (d === "apply") setCampaignNotes(value);
      else if (d === "confirm_replace") setPendingReplace({ field: "campaignNotes", proposed: value });
    },
    [campaignNotes, setCampaignNotes]
  );

  const applyContentPayload = useCallback(
    (payload: Record<string, unknown>) => {
      const audience = typeof payload.targetAudience === "string" ? payload.targetAudience : "";
      const offer = typeof payload.coreOffer === "string" ? payload.coreOffer : "";
      const transform = typeof payload.transformation === "string" ? payload.transformation : "";
      const toneVal = typeof payload.tone === "string" ? payload.tone : "";

      if (audience) {
        const d = decideStringPrefill(profile.targetAudience, audience);
        if (d === "apply") profile.setTargetAudience(audience);
        else if (d === "confirm_replace") setPendingReplace({ field: "targetAudience", proposed: audience });
      }
      if (offer) {
        const d = decideStringPrefill(profile.coreOffer, offer);
        if (d === "apply") profile.setCoreOffer(offer);
        else if (d === "confirm_replace") setPendingReplace({ field: "coreOffer", proposed: offer });
      }
      if (transform) {
        const d = decideStringPrefill(profile.transformation, transform);
        if (d === "apply") profile.setTransformation(transform);
        else if (d === "confirm_replace") setPendingReplace({ field: "transformation", proposed: transform });
      }
      if (toneVal) {
        const d = decideStringPrefill(tone, toneVal);
        if (d === "apply") setTone(toneVal);
        else if (d === "confirm_replace") setPendingReplace({ field: "tone", proposed: toneVal });
      }
    },
    [profile, tone, setTone]
  );

  const confirmReplaceExecute = useCallback(() => {
    if (!pendingReplace) return;
    switch (pendingReplace.field) {
      case "campaignNotes":
        setCampaignNotes(pendingReplace.proposed);
        break;
      case "targetAudience":
        profile.setTargetAudience(pendingReplace.proposed);
        break;
      case "coreOffer":
        profile.setCoreOffer(pendingReplace.proposed);
        break;
      case "transformation":
        profile.setTransformation(pendingReplace.proposed);
        break;
      case "tone":
        setTone(pendingReplace.proposed);
        break;
      default:
        break;
    }
    setPendingReplace(null);
  }, [pendingReplace, setCampaignNotes, profile, setTone]);

  const stale = useMemo(() => {
    if (!cycleProgress || !plan) return { hasMeaningfulChange: false, reasons: [] as string[] };
    return diffLaunchProgressAgainstCurrent({
      cycle: cycleProgress,
      currentPlanSummary: plan.summary,
      currentReadiness: { isReady: plan.readiness.isReady, blockerCount: plan.readiness.blockers.length },
      systemSignals,
      sharedProfile,
    });
  }, [cycleProgress, plan, systemSignals, sharedProfile]);

  if (!isProviderActive) return null;

  const displayReadiness = plan?.readiness ?? readinessLive;
  const activePlan = plan;

  return (
    <section
      id="seven-day-launch-mode"
      className="max-w-4xl mx-auto rounded-2xl border border-cyan-500/35 bg-slate-900/75 p-5 shadow-[0_4px_28px_rgba(0,209,255,0.1)] scroll-mt-24"
      aria-label="Seven-day launch mode"
    >
      {pendingReplace ? (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          <div className="font-semibold text-amber-200">Replace existing {pendingReplace.field}?</div>
          <p className="mt-1 text-xs text-amber-100/90">This overwrites your current text with the Launch Mode draft.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmReplaceExecute}
              className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-black"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setPendingReplace(null)}
              className="rounded-md border border-slate-500 px-3 py-1 text-xs text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {stale.hasMeaningfulChange ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/25 p-3 text-sm text-amber-100">
          <div className="font-semibold text-amber-200">Your launch inputs changed. Refresh recommended.</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {stale.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Launch execution</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">7-Day Launch Mode</h2>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            Week-by-week plan with session storage plus optional account sync when signed in. Actions log automatically; they
            never auto-run generation APIs. Tap a day card for recommended actions.
          </p>
          {cycleProgress ? (
            <p className="mt-2 text-xs text-cyan-400/90">
              Current focus: <strong>Day {cycleProgress.currentDay}</strong> · cycle{" "}
              <span className="font-mono text-cyan-300/80">{cycleProgress.cycleId.slice(0, 12)}…</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              displayReadiness.isReady
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                : "bg-amber-500/12 text-amber-200 ring-1 ring-amber-500/35"
            )}
          >
            {displayReadiness.isReady ? "Launch-ready band" : "Prep mode"}
          </span>
          {suggestLaunch ? (
            <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/40">
              Generate 7-Day Launch Plan
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium ring-1",
              syncUi === "synced"
                ? "bg-emerald-500/10 text-emerald-200/90 ring-emerald-500/30"
                : syncUi === "error"
                  ? "bg-rose-500/10 text-rose-200/90 ring-rose-500/35"
                  : syncUi === "syncing"
                    ? "bg-slate-600/30 text-slate-300 ring-slate-500/40"
                    : "bg-slate-700/40 text-slate-400 ring-slate-600/50"
            )}
            title={
              syncUi === "synced"
                ? "Progress saved to your account when signed in."
                : syncUi === "error"
                  ? "Could not reach launch sync — still saved in this browser."
                  : "Progress is stored in this browser; sign in to sync across devices."
            }
          >
            {syncUi === "syncing"
              ? "Syncing…"
              : syncUi === "synced"
                ? "Synced"
                : syncUi === "error"
                  ? "Sync failed"
                  : "Saved locally"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runGenerateOrRefresh}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 transition-colors"
        >
          {cycleProgress ? "Refresh plan" : "Generate Launch Plan"}
        </button>
        {cycleProgress ? (
          <button
            type="button"
            onClick={resumeLaunch}
            className="rounded-lg border border-cyan-500/50 bg-slate-800/80 px-4 py-2 text-sm font-medium text-cyan-200 hover:border-cyan-400 transition-colors"
          >
            Resume Launch
          </button>
        ) : null}
        <button
          type="button"
          onClick={startNewCycle}
          className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-200 transition-colors"
        >
          Start New Launch Cycle
        </button>
        <button
          type="button"
          disabled={!activePlan}
          onClick={() => void onCopy()}
          className={cn(
            "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            activePlan
              ? "border-slate-600 text-slate-200 hover:border-cyan-500/50"
              : "border-slate-700 text-slate-600 cursor-not-allowed"
          )}
        >
          {copyDone ? "Copied" : "Copy Plan"}
        </button>
      </div>

      {showDebug && cycleProgress ? (
        <div className="mt-3 rounded border border-slate-700 bg-black/50 p-2 font-mono text-[10px] text-slate-500">
          <div>cycleId: {cycleProgress.cycleId}</div>
          <div>serverCycleId: {cycleProgress.serverCycleId ?? "—"}</div>
          <div>currentDay: {cycleProgress.currentDay}</div>
          <div>
            statuses: {cycleProgress.days.map((d) => `D${d.day}=${d.status}`).join(", ")} · actions logged:{" "}
            {cycleProgress.days.reduce((n, d) => n + d.completedActions.length, 0)}
          </div>
          <div>stale: {String(stale.hasMeaningfulChange)} — {stale.reasons.join(" | ") || "—"}</div>
          <div>syncUi: {syncUi}</div>
          {(() => {
            const d = peekLaunchSyncClientDebug();
            return d ? (
              <div className="mt-1 space-y-0.5 border-t border-slate-800 pt-1 text-slate-400">
                <div>sync debug: {d.localVsRemote}</div>
                <div>direction: {d.syncDirection}</div>
                <div>lastSyncAt: {d.lastSyncAt}</div>
                <div>conflict: {d.conflict}</div>
              </div>
            ) : null;
          })()}
          <div className="mt-1 border-t border-slate-800 pt-1 text-slate-400">
            analytics: {JSON.stringify(summarizeLaunchCycleAnalytics(cycleProgress, { livePlanSummary: plan?.summary }))}
          </div>
        </div>
      ) : null}

      {!displayReadiness.isReady && displayReadiness.blockers.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-sm text-amber-100/95">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Blockers</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/90">
            {displayReadiness.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {displayReadiness.strengths.length > 0 ? (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3 text-sm text-emerald-100/95">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">Strengths</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {displayReadiness.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {activePlan ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">{activePlan.summary}</p>
          {(activePlan.launchAngle || activePlan.primaryOffer) && (
            <div className="text-xs text-slate-500 space-y-1">
              {activePlan.primaryOffer ? (
                <div>
                  <span className="text-slate-400">Offer thread:</span> {activePlan.primaryOffer}
                </div>
              ) : null}
              {activePlan.launchAngle ? (
                <div>
                  <span className="text-slate-400">Launch angle:</span> {activePlan.launchAngle}
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-3">
            {activePlan.days.map((d: RevenueOsLaunchDayPlan) => {
              const actions = mapLaunchDayToActions({
                dayPlan: d,
                launchPlan: activePlan,
                sharedProfile,
              });
              const debugSummary = showDebug ? summarizeLaunchDayActionsForDebug(actions) : null;
              const isFocused = focusedDay === d.day;
              const dayState = cycleProgress?.days.find((x) => x.day === d.day);
              const status: RevenueOsLaunchDayExecutionStatus = dayState?.status ?? "not_started";

              return (
                <article
                  key={d.day}
                  className={cn(
                    "rounded-xl border bg-slate-950/40 p-4 transition-shadow",
                    isFocused ? "border-cyan-500/55 ring-1 ring-cyan-500/30" : "border-slate-700/80",
                    cycleProgress && d.day === cycleProgress.currentDay ? "border-l-2 border-l-cyan-500/70" : ""
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedDay((fd) => (fd === d.day ? null : d.day))}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-cyan-300">
                        Day {d.day} · {d.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                            statusBadgeClass(status)
                          )}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                        {d.recommendedStep != null ? (
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                            Step {d.recommendedStep}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{d.objective}</p>
                  </button>

                  {cycleProgress ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        type="button"
                        className="rounded-md border border-slate-600 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-cyan-500/50"
                        onClick={() => mutateProgress((p) => setLaunchDayStatus(p, d.day, "in_progress"))}
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-emerald-600/40 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-950/30"
                        onClick={() => mutateProgress((p) => setLaunchDayStatus(p, d.day, "completed"))}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-600/40 px-2 py-1 text-[10px] font-medium text-rose-200 hover:bg-rose-950/30"
                        onClick={() => mutateProgress((p) => setLaunchDayStatus(p, d.day, "blocked"))}
                      >
                        Blocked
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
                        onClick={() => mutateProgress((p) => resetLaunchDay(p, d.day, { clearNotes: true }))}
                      >
                        Reset day
                      </button>
                    </div>
                  ) : null}

                  {cycleProgress ? (
                    <label className="mt-2 block text-[10px] uppercase text-slate-500">
                      Day note
                      <textarea
                        key={`${cycleProgress.cycleId}-d${d.day}-note`}
                        defaultValue={dayState?.notes ?? ""}
                        onBlur={(e) => mutateProgress((p) => setLaunchDayNotes(p, d.day, e.target.value))}
                        rows={2}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
                        placeholder="Optional context for this day…"
                      />
                    </label>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-slate-500">Tasks</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-400">
                        {d.tasks.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-slate-500">Deliverables</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-400">
                        {d.deliverables.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {isFocused ? (
                    <div className="mt-4 border-t border-slate-700/80 pt-3">
                      <div className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Recommended actions</div>
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action, i) => (
                          <LaunchActionRow
                            key={`${d.day}-${i}-${action.kind}`}
                            action={action}
                            onScroll={handleScroll}
                            onPrefillNotes={applyCampaignNotes}
                            onPrefillContext={applyContentPayload}
                            onSuggestPick={setHighlightSuggest}
                            onActionInvoked={(aid) => recordAction(d.day, aid)}
                          />
                        ))}
                      </div>
                      {highlightSuggest &&
                      actions.some(
                        (a) =>
                          (a.kind === "suggest_generate_content" ||
                            a.kind === "suggest_generate_campaign" ||
                            a.kind === "suggest_compile_media_brief" ||
                            a.kind === "suggest_batch_variations" ||
                            a.kind === "suggest_queue_review") &&
                          a.label === highlightSuggest
                      ) ? (
                        <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/95">
                          <span className="font-semibold text-cyan-300/90">Run manually in Step 4: </span>
                          {highlightSuggest}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {showDebug && debugSummary ? (
                    <div className="mt-3 rounded border border-slate-700/80 bg-black/40 p-2 font-mono text-[10px] text-slate-500">
                      <div>kinds: {debugSummary.kinds.join(", ")}</div>
                      <div>scroll: {debugSummary.scrollTargets.join(" → ")}</div>
                      <div>
                        prefill: notes={String(debugSummary.prefillAvailable.campaignNotes)} keys=[
                        {debugSummary.prefillAvailable.contentKeys.join(", ")}]
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Tap <strong className="text-slate-300">Generate Launch Plan</strong> to start a cycle, or use{" "}
          <strong className="text-slate-300">Resume launch</strong> if you already have one saved. Ask Bentley: &quot;resume
          launch&quot; or &quot;what day am I on&quot;.
        </p>
      )}
    </section>
  );
}
