"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAiRevenueOsPostingPlatforms,
  useAiRevenueOsProfile,
  useAiRevenueOsSystemSignals,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  buildSevenDayLaunchPlan,
  getLaunchReadinessContributorForDebug,
} from "@/lib/revenue-os/build-seven-day-launch-plan";
import { mapLaunchDayToActions, summarizeLaunchDayActionsForDebug } from "@/lib/revenue-os/map-launch-day-to-actions";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type {
  BentleyAutonomyLifecycleBand,
  BentleyAutonomyReadinessReport,
} from "@/lib/revenue-os/bentley-autonomy-readiness";
import { BENTLEY_LIFECYCLE_STAGE_ORDER, type BentleyLifecycleStageId } from "@/lib/revenue-os/bentley-lifecycle";
import {
  buildSystemSignalDiagnosticSummary,
  mapSystemSignalsToNextActions,
} from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import type { SocialPlatform } from "@/lib/social/config";
import {
  BENTLEY_OBSERVABILITY_CHANGED_EVENT,
  readBentleyObservabilitySession,
  getBentleyActiveRunId,
  type BentleyOrchestrationRunRecord,
} from "@/lib/revenue-os/bentley-run-observability";
import { isRunLockHeld } from "@/lib/revenue-os/bentley-run-lock";
import {
  BENTLEY_STORAGE_SCOPE_CHANGED_EVENT,
  getBentleyStorageScope,
} from "@/lib/revenue-os/bentley-storage-scope";
import { summarizeLaunchCycleAnalytics } from "@/lib/revenue-os/launch-analytics-summary";
import { diffLaunchProgressAgainstCurrent } from "@/lib/revenue-os/launch-progress-diff";
import {
  LAUNCH_CYCLE_PROGRESS_STORAGE_KEY,
  LAUNCH_PROGRESS_UPDATED_EVENT,
  loadLaunchCycleProgress,
} from "@/lib/revenue-os/launch-progress-storage";
import { peekLaunchSyncClientDebug } from "@/lib/revenue-os/launch-progress-sync-client-debug";
import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";
import { useBentleyLaunchMismatchStatus } from "@/components/revenue-os/use-bentley-launch-mismatch-status";

function shouldShowObservabilityPanel(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  return process.env.NEXT_PUBLIC_BENTLEY_OBS_UI === "1";
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  x: "X",
};

function formatTs(ms?: number): string {
  if (ms == null) return "—";
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ms);
  }
}

export function BentleyRunObservabilityDebugPanel() {
  const { systemSignals } = useAiRevenueOsSystemSignals();
  const profile = useAiRevenueOsProfile();
  const { postingPlatforms } = useAiRevenueOsPostingPlatforms();
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<BentleyOrchestrationRunRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scopeLabel, setScopeLabel] = useState<string>("legacy (unscoped)");
  const [launchCycleProgress, setLaunchCycleProgress] = useState<RevenueOsLaunchCycleProgress | null>(null);
  const [clientLaunchSyncDebug, setClientLaunchSyncDebug] = useState<ReturnType<typeof peekLaunchSyncClientDebug>>(null);
  const [autonomyReport, setAutonomyReport] = useState<BentleyAutonomyReadinessReport | null>(null);
  const [autonomyLoading, setAutonomyLoading] = useState(false);
  const [autonomyErr, setAutonomyErr] = useState<string | null>(null);
  const diag = buildSystemSignalDiagnosticSummary(systemSignals);
  const nextActs = mapSystemSignalsToNextActions(systemSignals);

  const launchPlanDebug = useMemo(() => {
    const wf = loadWorkflowState();
    return buildSevenDayLaunchPlan({
      systemSignals,
      sharedProfile: {
        businessName: profile.businessName,
        coreOffer: profile.coreOffer,
        transformation: profile.transformation,
        targetAudience: profile.targetAudience,
        industry: profile.effectiveIndustryLabel,
        postingPlatforms: postingPlatforms.map((p) => PLATFORM_LABELS[p] ?? p),
      },
      trendsResult: wf.artifacts.trends ?? undefined,
      researchResult: wf.artifacts.research ?? undefined,
      workflowState: wf,
    });
  }, [
    systemSignals,
    profile.businessName,
    profile.coreOffer,
    profile.transformation,
    profile.targetAudience,
    profile.effectiveIndustryLabel,
    postingPlatforms,
  ]);

  const launchContrib = getLaunchReadinessContributorForDebug(systemSignals, launchPlanDebug.readiness);

  const sharedProfileObs = useMemo(
    () => ({
      businessName: profile.businessName,
      coreOffer: profile.coreOffer,
      transformation: profile.transformation,
      targetAudience: profile.targetAudience,
      industry: profile.effectiveIndustryLabel,
      postingPlatforms: postingPlatforms.map((p) => PLATFORM_LABELS[p] ?? p),
    }),
    [
      profile.businessName,
      profile.coreOffer,
      profile.transformation,
      profile.targetAudience,
      profile.effectiveIndustryLabel,
      postingPlatforms,
    ]
  );

  const sessionLifecycleSummary = useMemo(() => {
    const wf = loadWorkflowState();
    const lc = wf.lifecycle ?? {};
    return BENTLEY_LIFECYCLE_STAGE_ORDER.filter((id) => lc[id])
      .map((id) => {
        const r = lc[id as BentleyLifecycleStageId];
        return r ? `${id}=${r.status}` : null;
      })
      .filter(Boolean)
      .join(" · ");
  }, [autonomyReport, open]);

  const launchStaleDiff = useMemo(() => {
    if (!launchCycleProgress) return null;
    return diffLaunchProgressAgainstCurrent({
      cycle: launchCycleProgress,
      currentPlanSummary: launchPlanDebug.summary,
      currentReadiness: {
        isReady: launchPlanDebug.readiness.isReady,
        blockerCount: launchPlanDebug.readiness.blockers.length,
      },
      systemSignals,
      sharedProfile: sharedProfileObs,
    });
  }, [
    launchCycleProgress,
    launchPlanDebug.summary,
    launchPlanDebug.readiness.isReady,
    launchPlanDebug.readiness.blockers.length,
    systemSignals,
    sharedProfileObs,
  ]);

  const launchAnalyticsObs = useMemo(() => {
    if (!launchCycleProgress) return null;
    return summarizeLaunchCycleAnalytics(launchCycleProgress, { livePlanSummary: launchPlanDebug.summary });
  }, [launchCycleProgress, launchPlanDebug.summary]);

  const launchMismatch = useBentleyLaunchMismatchStatus();

  const refresh = useCallback(() => {
    setRuns(readBentleyObservabilitySession().runs);
    setActiveId(getBentleyActiveRunId());
    const s = getBentleyStorageScope();
    setScopeLabel(
      s ? `u:${s.userId} · c:${s.clientId}` : "legacy (unscoped)"
    );
    setLaunchCycleProgress(loadLaunchCycleProgress(LAUNCH_CYCLE_PROGRESS_STORAGE_KEY));
    setClientLaunchSyncDebug(peekLaunchSyncClientDebug());
  }, []);

  const loadAutonomyReadiness = useCallback(async () => {
    setAutonomyLoading(true);
    setAutonomyErr(null);
    try {
      const wf = loadWorkflowState();
      const cid = getBentleyStorageScope()?.clientId ?? "";
      const res = await fetch("/api/revenue-os/bentley/autonomy-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId: cid, workflow: wf }),
      });
      const j = (await res.json()) as { ok?: boolean; report?: BentleyAutonomyReadinessReport; error?: string };
      if (!res.ok || !j.ok || !j.report) {
        setAutonomyErr(j.error ?? `HTTP ${res.status}`);
        setAutonomyReport(null);
        return;
      }
      setAutonomyReport(j.report);
    } catch (e) {
      setAutonomyErr(e instanceof Error ? e.message : String(e));
      setAutonomyReport(null);
    } finally {
      setAutonomyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldShowObservabilityPanel()) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = 0;
      refresh();
    });
    const onObs = () => refresh();
    const onScope = () => refresh();
    const onLaunchProgress = () => refresh();
    window.addEventListener(BENTLEY_OBSERVABILITY_CHANGED_EVENT, onObs);
    window.addEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
    window.addEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, onLaunchProgress);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener(BENTLEY_OBSERVABILITY_CHANGED_EVENT, onObs);
      window.removeEventListener(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT, onScope);
      window.removeEventListener(LAUNCH_PROGRESS_UPDATED_EVENT, onLaunchProgress);
    };
  }, [refresh]);

  if (!shouldShowObservabilityPanel()) return null;

  const latest = runs[runs.length - 1];

  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-[100] max-w-[min(420px,calc(100vw-1.5rem))] text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1 rounded-md border border-amber-500/50 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/95 hover:bg-amber-950/50"
      >
        Bentley obs {open ? "▾" : "▸"}
      </button>
      {open ? (
        <div className="rounded-lg border border-amber-500/40 bg-slate-950/95 p-2.5 text-[10px] text-slate-200 shadow-xl backdrop-blur-md font-mono leading-snug">
          <div className="text-amber-300/90 mb-1.5">Internal — session observability</div>
          <div className="mb-2 border-b border-white/10 pb-2 space-y-1 text-slate-400">
            <div className="text-amber-200/80">Launch sync / workflow drift</div>
            {launchMismatch.loadingPosts && coerceTrimmedString(launchMismatch.workflow.artifacts.bentleyDbCampaignId) ? (
              <div className="text-slate-500">Loading campaign post count (GET /api/campaigns)…</div>
            ) : null}
            {launchMismatch.operationalBlockers.length > 0 ? (
              <div className="mb-2 space-y-1 rounded border border-rose-500/30 bg-rose-950/20 px-2 py-1.5 text-[9px] text-rose-100/90">
                <div className="font-semibold text-rose-200/90">Operational blockers (server + campaign)</div>
                <ul className="list-disc space-y-0.5 pl-3">
                  {launchMismatch.operationalBlockers.map((b) => (
                    <li key={b.code} className="break-words">
                      <span className="font-mono opacity-80">{b.code}</span> — {b.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {launchMismatch.issues.length === 0 ? (
              <div className="text-emerald-400/90">No mismatch flags for current session + campaign fetch.</div>
            ) : (
              <div className="space-y-1.5">
                {launchMismatch.lines.map((m) => (
                  <div key={m.code} className="break-words border-l border-amber-500/35 pl-2">
                    <div className="text-amber-200/90">{m.code}</div>
                    <div className="text-slate-200">{m.title}</div>
                    <div className="text-slate-500">{m.detail}</div>
                  </div>
                ))}
                <div className="text-slate-600 break-all">issues: {launchMismatch.issues.join(" | ")}</div>
              </div>
            )}
          </div>
          <div className="mb-2 border-b border-white/10 pb-2 space-y-1.5 text-slate-400">
            <div className="text-amber-200/80">Autonomy readiness (server + session)</div>
            <button
              type="button"
              className="rounded border border-amber-500/40 px-2 py-0.5 text-[9px] text-amber-200/90 hover:bg-amber-500/10"
              disabled={autonomyLoading}
              onClick={() => void loadAutonomyReadiness()}
            >
              {autonomyLoading ? "Loading…" : "Load readiness report"}
            </button>
            {autonomyErr ? <div className="text-rose-300/90 break-words">{autonomyErr}</div> : null}
            {autonomyReport ? (
              <div className="space-y-1 text-slate-300">
                <div className="text-slate-500">{autonomyReport.summaryLine}</div>
                <div className="text-slate-500">blocked: {autonomyReport.blockedCount}</div>
                {autonomyReport.operationalBlockers?.length ? (
                  <div className="mt-1 space-y-0.5 border-l border-rose-500/35 pl-2 text-[9px] text-rose-100/90">
                    <div className="text-rose-300/85">Operational blockers</div>
                    {autonomyReport.operationalBlockers.map((b) => (
                      <div key={b.code} className="break-words">
                        <span className="font-mono text-rose-200/80">{b.code}</span> — {b.detail}
                      </div>
                    ))}
                  </div>
                ) : null}
                {autonomyReport.lifecycleBands?.length ? (
                  <div className="mt-1 space-y-0.5 border-l border-cyan-500/30 pl-2 text-[9px] text-cyan-100/90">
                    <div className="text-cyan-300/85">Lifecycle bands</div>
                    {autonomyReport.lifecycleBands.map((b: BentleyAutonomyLifecycleBand) => (
                      <div key={b.id} className="break-words">
                        <span
                          className={
                            b.status === "ok"
                              ? "text-emerald-400"
                              : b.status === "blocked"
                                ? "text-rose-300"
                                : b.status === "waiting"
                                  ? "text-amber-200/90"
                                  : "text-slate-400"
                          }
                        >
                          [{b.status}]
                        </span>{" "}
                        <span className="text-slate-500">{b.id}:</span> {b.detail}
                      </div>
                    ))}
                  </div>
                ) : null}
                {autonomyReport.areas.map((a) => (
                  <div key={a.id} className="border-l border-white/10 pl-2">
                    <span
                      className={
                        a.status === "ok"
                          ? "text-emerald-400"
                          : a.status === "blocked"
                            ? "text-rose-300"
                            : a.status === "waiting"
                              ? "text-amber-200/90"
                              : "text-slate-400"
                      }
                    >
                      [{a.status}]
                    </span>{" "}
                    <span className="text-slate-500">{a.id}:</span> {a.detail}
                  </div>
                ))}
              </div>
            ) : null}
            {autonomyReport && open ? (
              <div className="mt-1 text-[9px] text-slate-500 break-words border-t border-white/10 pt-1">
                <span className="text-slate-600">session lifecycle:</span> {sessionLifecycleSummary || "—"}
              </div>
            ) : null}
          </div>
          <div className="mb-1.5 text-slate-500 break-words">
            <span className="text-slate-500">storage scope:</span>{" "}
            <span className="text-slate-300">{scopeLabel}</span>
          </div>
          <div className="space-y-1 text-slate-400">
            <div>
              <span className="text-slate-500">run lock:</span>{" "}
              <span className={isRunLockHeld() ? "text-amber-300" : "text-emerald-400"}>
                {isRunLockHeld() ? "held" : "free"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">activeRunId:</span> {activeId ?? "—"}
            </div>
            {latest ? (
              <>
                <div>
                  <span className="text-slate-500">latest outcome:</span>{" "}
                  <span className="text-slate-200">{latest.outcome ?? "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">last error:</span>{" "}
                  <span className="text-rose-300/95 break-words">{latest.lastError ?? "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">failed phase:</span> {latest.failedPhase ?? "—"}
                </div>
                <div>
                  <span className="text-slate-500">persist ok / fail:</span>{" "}
                  {latest.workflowPersistOk} / {latest.workflowPersistFailed}
                </div>
                <div>
                  <span className="text-slate-500">resumed:</span> {latest.resumedFromWorkflow ? "yes" : "no"}
                </div>
                <div>
                  <span className="text-slate-500">handoff in session:</span>{" "}
                  {latest.dashboardHandoffUsed ? "yes" : "no"}
                </div>
                <div>
                  <span className="text-slate-500">launch readiness:</span>{" "}
                  {latest.launchReadinessSnapshot?.finalKind ?? "—"}
                </div>
                <div className="text-slate-500">
                  started {formatTs(latest.startedAt)} → ended {formatTs(latest.endedAt)}
                </div>
              </>
            ) : (
              <div className="text-slate-500">No runs recorded this session.</div>
            )}
            <div className="mt-2 border-t border-white/10 pt-2 space-y-1 text-slate-400">
              <div className="text-amber-200/80">5-system diagnostics (debug)</div>
              <div>
                <span className="text-slate-500">strongestSystem:</span> {diag.strongestSystem ?? "—"}
              </div>
              <div>
                <span className="text-slate-500">weakestSystem:</span> {diag.weakestSystem ?? "—"}
              </div>
              <div>
                <span className="text-slate-500">recommendedStep:</span>{" "}
                {nextActs.recommendedStep === null ? "—" : String(nextActs.recommendedStep)}
              </div>
              <div>
                <span className="text-slate-500">primaryAction:</span>{" "}
                <span className="break-words text-slate-300">{nextActs.primaryAction}</span>
              </div>
              <div className="text-slate-500">
                raw: opp {systemSignals.opportunityScore ?? "—"} · offer {systemSignals.offerStrengthScore ?? "—"} ·
                traffic {systemSignals.trafficReadinessScore ?? "—"} · gap {systemSignals.executionGapScore ?? "—"} ·
                cap {systemSignals.capitalReadinessScore ?? "—"}
              </div>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 space-y-1 text-slate-400">
              <div className="text-amber-200/80">7-day launch mode (debug)</div>
              <div>
                <span className="text-slate-500">readiness:</span>{" "}
                {launchPlanDebug.readiness.isReady ? "ready" : "not_ready"}
              </div>
              <div>
                <span className="text-slate-500">blockerCount:</span> {launchPlanDebug.readiness.blockers.length}
              </div>
              <div>
                <span className="text-slate-500">planSummary:</span>{" "}
                <span className="break-words text-slate-300">{launchPlanDebug.summary.slice(0, 220)}</span>
                {launchPlanDebug.summary.length > 220 ? "…" : ""}
              </div>
              <div>
                <span className="text-slate-500">signalContext:</span> {launchContrib.role} ·{" "}
                {launchContrib.system ?? "—"}
              </div>
              <div className="mt-1 space-y-0.5 text-slate-500">
                <div className="text-amber-200/70">per-day actions</div>
                {launchPlanDebug.days.map((d) => {
                  const sm = summarizeLaunchDayActionsForDebug(
                    mapLaunchDayToActions({
                      dayPlan: d,
                      launchPlan: launchPlanDebug,
                      sharedProfile: {
                        businessName: profile.businessName,
                        coreOffer: profile.coreOffer,
                        transformation: profile.transformation,
                        targetAudience: profile.targetAudience,
                        industry: profile.effectiveIndustryLabel,
                        postingPlatforms: postingPlatforms.map((p) => PLATFORM_LABELS[p] ?? p),
                      },
                    })
                  );
                  return (
                    <div key={d.day} className="break-words">
                      D{d.day}: kinds [{sm.kinds.join(", ")}] · targets [{sm.scrollTargets.join(" → ")}] · prefill notes=
                      {String(sm.prefillAvailable.campaignNotes)} · ctx keys [{sm.prefillAvailable.contentKeys.join(", ")}]
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-slate-400">
                <div className="text-amber-200/80">launch cycle progress (session)</div>
                {launchCycleProgress ? (
                  <>
                    <div>
                      <span className="text-slate-500">cycleId:</span>{" "}
                      <span className="break-all text-slate-300">{launchCycleProgress.cycleId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">currentDay:</span> {launchCycleProgress.currentDay}
                    </div>
                    <div>
                      <span className="text-slate-500">day statuses:</span>{" "}
                      {launchCycleProgress.days.map((d) => `D${d.day}:${d.status}`).join(" · ")}
                    </div>
                    <div>
                      <span className="text-slate-500">logged actions / day:</span>{" "}
                      {launchCycleProgress.days.map((d) => d.completedActions.length).join(", ")}
                    </div>
                    <div>
                      <span className="text-slate-500">stale vs live plan:</span>{" "}
                      <span className={launchStaleDiff?.hasMeaningfulChange ? "text-amber-300" : "text-emerald-400"}>
                        {launchStaleDiff?.hasMeaningfulChange ? "yes" : "no"}
                      </span>
                    </div>
                    {launchStaleDiff?.reasons.length ? (
                      <div className="space-y-0.5 text-slate-500">
                        {launchStaleDiff.reasons.map((r, i) => (
                          <div key={`${i}-${r.slice(0, 24)}`} className="break-words">
                            • {r}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-slate-500">No saved launch cycle in session.</div>
                )}
                <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-slate-500">
                  <div className="text-amber-200/75">launch sync client (debug)</div>
                  {clientLaunchSyncDebug ? (
                    <>
                      <div className="break-words">
                        <span className="text-slate-500">local vs remote:</span> {clientLaunchSyncDebug.localVsRemote}
                      </div>
                      <div>
                        <span className="text-slate-500">direction:</span> {clientLaunchSyncDebug.syncDirection}
                      </div>
                      <div className="break-words">
                        <span className="text-slate-500">lastSyncAt:</span> {clientLaunchSyncDebug.lastSyncAt}
                      </div>
                      <div>
                        <span className="text-slate-500">conflict:</span> {clientLaunchSyncDebug.conflict}
                      </div>
                    </>
                  ) : (
                    <div>—</div>
                  )}
                  {launchAnalyticsObs ? (
                    <div className="break-words text-slate-400">
                      <span className="text-slate-500">analytics:</span> {JSON.stringify(launchAnalyticsObs)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-slate-500">
            Runs in buffer: {runs.length} (max 25)
          </div>
        </div>
      ) : null}
    </div>
  );
}
