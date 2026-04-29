/**
 * Session-scoped internal observability for Bentley `runFullPipeline` (no product UX change).
 * Persists to sessionStorage; optional debug UI in development.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY } from "@/lib/revenue-os/bentley-dashboard-handoff";
import {
  bentleyScopedSessionKey,
  readBentleySessionWithLegacyFallback,
} from "@/lib/revenue-os/bentley-storage-scope";
import { readFirstCampaignDraftMeta } from "@/lib/revenue-os/bentley-first-campaign-ui";
import type { LaunchReadinessFinalKind } from "@/lib/revenue-os/bentley-launch-readiness-summary";
import type { BentleyPipelineProgressDetail } from "@/lib/revenue-os/bentley-pipeline-progress";
import { isRunLockHeld } from "@/lib/revenue-os/bentley-run-lock";
import type { BentleyWorkflowPhaseId, BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { SocialPlatform } from "@/lib/social/config";

export const BENTLEY_OBSERVABILITY_STORAGE_KEY = "revenue-os:bentley-run-observability-v1";
export const BENTLEY_OBSERVABILITY_CHANGED_EVENT = "bentley:run-observability-changed";

const MAX_RUNS = 25;

const PIPELINE_RESUME_PHASES: BentleyWorkflowPhaseId[] = [
  "research",
  "trends",
  "market_sweep",
  "content",
  "campaign_notes",
  "campaign_generation",
  "media_brief",
  "analysis",
];

export type BentleyRunLockStateObs = "none" | "held" | "failed_acquire" | "released";

export type CompactLaunchReadinessSnapshot = {
  finalKind: LaunchReadinessFinalKind;
  rows: { id: string; ok: boolean }[];
  oauthUnknown: boolean;
  note?: string;
};

export type BentleyOrchestrationRunRecord = {
  runId: string;
  userId: string;
  clientId?: string;
  startedAt: number;
  endedAt?: number;
  resumedFromWorkflow: boolean;
  currentPhase: BentleyWorkflowPhaseId | null;
  completedPhases: BentleyWorkflowPhaseId[];
  failedPhase?: BentleyWorkflowPhaseId | null;
  lastError?: string | null;
  runLockState: BentleyRunLockStateObs;
  workflowPersistOk: number;
  workflowPersistFailed: number;
  dashboardHandoffUsed?: boolean;
  launchReadinessSnapshot?: CompactLaunchReadinessSnapshot;
  outcome?: "running" | "complete" | "failed" | "blocked_intake" | "blocked_lock" | "aborted";
};

type SessionFile = {
  runs: BentleyOrchestrationRunRecord[];
};

function emitObservabilityChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BENTLEY_OBSERVABILITY_CHANGED_EVENT));
}

function observabilityStorageKey(): string {
  return bentleyScopedSessionKey(BENTLEY_OBSERVABILITY_STORAGE_KEY);
}

function loadSession(): SessionFile {
  if (typeof window === "undefined") return { runs: [] };
  try {
    const sk = observabilityStorageKey();
    let raw = sessionStorage.getItem(sk);
    if (!raw) {
      raw = sessionStorage.getItem(BENTLEY_OBSERVABILITY_STORAGE_KEY);
      if (raw) {
        try {
          sessionStorage.setItem(sk, raw);
          sessionStorage.removeItem(BENTLEY_OBSERVABILITY_STORAGE_KEY);
        } catch {
          // quota
        }
      }
    }
    if (!raw) return { runs: [] };
    const j = JSON.parse(raw) as SessionFile;
    if (!j?.runs || !Array.isArray(j.runs)) return { runs: [] };
    return { runs: j.runs };
  } catch {
    return { runs: [] };
  }
}

function saveSession(runs: BentleyOrchestrationRunRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = runs.slice(-MAX_RUNS);
    sessionStorage.setItem(observabilityStorageKey(), JSON.stringify({ runs: trimmed }));
    emitObservabilityChanged();
  } catch {
    // quota — ignore
  }
}

let activeRunId: string | null = null;

function newRunId(): string {
  return `bentley-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function handoffPresent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return readBentleySessionWithLegacyFallback(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function buildCompactLaunchReadinessForRunner(
  wf: BentleyWorkflowState,
  snap: Pick<BentleySnapshot, "postingPlatforms">
): CompactLaunchReadinessSnapshot {
  const hasDraft = typeof window !== "undefined" && readFirstCampaignDraftMeta() != null;
  // Lazy require avoids circular init: bentley-workflow → observability → launch-readiness → bentley-workflow
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional late bind
  const { computeBentleyLaunchReadinessSummary } =
    require("./bentley-launch-readiness-summary") as typeof import("./bentley-launch-readiness-summary");
  const summary = computeBentleyLaunchReadinessSummary({
    wf,
    postingPlatforms: snap.postingPlatforms ?? [],
    connectedSocialPlatforms: new Set<SocialPlatform>(),
    analysis: null,
    contentEngineOutput: null,
    hasSessionDraftMeta: hasDraft,
  });
  return {
    finalKind: summary.finalKind,
    rows: summary.rows.map((r) => ({ id: r.id, ok: r.ok })),
    oauthUnknown: true,
    note: "OAuth not resolved during pipeline run — dashboard uses live /api/social/accounts.",
  };
}

/** Called from `saveWorkflowState` — increments persist counters for the active orchestration run only. */
export function notifyBentleyWorkflowPersist(success: boolean): void {
  if (!activeRunId) return;
  const s = loadSession();
  const idx = s.runs.findIndex((r) => r.runId === activeRunId);
  if (idx < 0) return;
  const r = s.runs[idx]!;
  if (success) r.workflowPersistOk += 1;
  else r.workflowPersistFailed += 1;
  s.runs[idx] = r;
  saveSession(s.runs);
}

function patchActiveRun(patch: Partial<BentleyOrchestrationRunRecord>): void {
  if (!activeRunId) return;
  const s = loadSession();
  const idx = s.runs.findIndex((r) => r.runId === activeRunId);
  if (idx < 0) return;
  s.runs[idx] = { ...s.runs[idx]!, ...patch };
  saveSession(s.runs);
}

/** Sync progress detail into the active run (same-tab pipeline). */
export function syncBentleyRunFromPipelineDetail(detail: BentleyPipelineProgressDetail): void {
  if (!activeRunId) return;
  const completed = (detail.completedPhases ?? []) as BentleyWorkflowPhaseId[];
  patchActiveRun({
    currentPhase: detail.activePhase ?? null,
    completedPhases: completed,
    ...(detail.mode === "failed"
      ? {
          failedPhase: detail.failedPhase ?? null,
          lastError: detail.errorMessage ?? detail.statusLine,
          outcome: "failed" as const,
        }
      : {}),
  });
}

export function readBentleyObservabilitySession(): SessionFile {
  return loadSession();
}

export function getBentleyActiveRunId(): string | null {
  return activeRunId;
}

/** Correlation context for the active orchestration run (browser session only). */
export function getBentleyActiveRunCorrelationContext(): {
  runId: string;
  userId: string;
  clientId?: string;
} | null {
  if (!activeRunId) return null;
  const s = loadSession();
  const r = s.runs.find((x) => x.runId === activeRunId);
  if (!r) return null;
  return { runId: r.runId, userId: r.userId, clientId: r.clientId };
}

export function computeResumedFromWorkflow(wf: BentleyWorkflowState): boolean {
  if (wf.lastFailedPhase) return true;
  return PIPELINE_RESUME_PHASES.some((p) => Boolean(wf.completed[p]));
}

/**
 * Begin a new orchestration run record (call immediately after lock acquired).
 */
export function startBentleyOrchestrationRun(input: {
  userId: string;
  clientId?: string;
  resumedFromWorkflow: boolean;
}): string {
  const runId = newRunId();
  activeRunId = runId;
  const rec: BentleyOrchestrationRunRecord = {
    runId,
    userId: input.userId,
    clientId: input.clientId,
    startedAt: Date.now(),
    resumedFromWorkflow: input.resumedFromWorkflow,
    currentPhase: null,
    completedPhases: [],
    runLockState: "held",
    workflowPersistOk: 0,
    workflowPersistFailed: 0,
    outcome: "running",
  };
  const s = loadSession();
  s.runs.push(rec);
  saveSession(s.runs);
  return runId;
}

export function recordBentleyRunBlockedIntake(input: { userId: string; clientId?: string }): void {
  const runId = newRunId();
  const rec: BentleyOrchestrationRunRecord = {
    runId,
    userId: input.userId,
    clientId: input.clientId,
    startedAt: Date.now(),
    endedAt: Date.now(),
    resumedFromWorkflow: false,
    currentPhase: null,
    completedPhases: [],
    runLockState: "none",
    workflowPersistOk: 0,
    workflowPersistFailed: 0,
    outcome: "blocked_intake",
    lastError: "Intake incomplete",
  };
  const s = loadSession();
  s.runs.push(rec);
  saveSession(s.runs);
}

export function recordBentleyRunBlockedByLock(input: { userId: string; clientId?: string }): void {
  const runId = newRunId();
  const rec: BentleyOrchestrationRunRecord = {
    runId,
    userId: input.userId,
    clientId: input.clientId,
    startedAt: Date.now(),
    endedAt: Date.now(),
    resumedFromWorkflow: false,
    currentPhase: null,
    completedPhases: [],
    runLockState: "failed_acquire",
    workflowPersistOk: 0,
    workflowPersistFailed: 0,
    outcome: "blocked_lock",
    lastError: "Pipeline already running (lock not acquired)",
  };
  const s = loadSession();
  s.runs.push(rec);
  saveSession(s.runs);
}

/**
 * Finalize the active run after `runFullPipeline` returns or aborts.
 */
export function endBentleyOrchestrationRun(input: {
  wf: BentleyWorkflowState;
  snapshot: Pick<BentleySnapshot, "postingPlatforms">;
  outcome: "complete" | "failed" | "blocked_intake" | "aborted";
  failedPhase?: BentleyWorkflowPhaseId | null;
  lastError?: string | null;
}): void {
  const id = activeRunId;
  if (!id) return;
  activeRunId = null;
  const s = loadSession();
  const idx = s.runs.findIndex((r) => r.runId === id);
  if (idx < 0) return;
  const endedAt = Date.now();
  const launchReadinessSnapshot = buildCompactLaunchReadinessForRunner(input.wf, input.snapshot);
  s.runs[idx] = {
    ...s.runs[idx]!,
    endedAt,
    outcome: input.outcome,
    failedPhase: input.failedPhase ?? null,
    lastError: input.lastError ?? null,
    currentPhase: null,
    completedPhases: (Object.keys(input.wf.completed) as BentleyWorkflowPhaseId[]).filter(
      (k) => input.wf.completed[k]
    ),
    runLockState: isRunLockHeld() ? "held" : "released",
    dashboardHandoffUsed: handoffPresent(),
    launchReadinessSnapshot,
  };
  saveSession(s.runs);
}
