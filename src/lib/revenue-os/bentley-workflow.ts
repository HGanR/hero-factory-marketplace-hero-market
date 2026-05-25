/**
 * Bentley workflow phase machine — persisted in sessionStorage for resume across navigation.
 */

import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { SynthesizePlanResult } from "@/lib/revenue-os/revenue-os-pipeline-actions";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import { slimLifecycleProgress, type BentleyLifecycleProgress } from "@/lib/revenue-os/bentley-lifecycle";
import { slimWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow-artifacts-slim";
import { coerceTrimmedString, sanitizeBentleyWorkflowStateFromStorage } from "@/lib/revenue-os/bentley-string-coerce";
import { notifyBentleyWorkflowPersist } from "@/lib/revenue-os/bentley-run-observability";
import {
  bentleyScopedSessionKey,
  getBentleyStorageScope,
  removeAllSessionKeysForLogicalBase,
} from "@/lib/revenue-os/bentley-storage-scope";

/** v3: slimmed artifacts on save; optional `lastFailedPhase` for resume UX. */
export const BENTLEY_WORKFLOW_STORAGE_KEY = "revenue-os:bentley-workflow-v3";
const BENTLEY_WORKFLOW_STORAGE_KEY_LEGACY = "revenue-os:bentley-workflow-v2";

function primaryWorkflowKey(): string {
  return bentleyScopedSessionKey(BENTLEY_WORKFLOW_STORAGE_KEY);
}

/** Read raw JSON: scoped first, then legacy unscoped migration, then v2 legacy. */
function readWorkflowRaw(): string | null {
  if (typeof window === "undefined") return null;
  const scoped = getBentleyStorageScope() ? primaryWorkflowKey() : null;
  if (scoped) {
    let raw = sessionStorage.getItem(scoped);
    if (raw) return raw;
    raw = sessionStorage.getItem(BENTLEY_WORKFLOW_STORAGE_KEY);
    if (raw) {
      try {
        sessionStorage.setItem(scoped, raw);
        sessionStorage.removeItem(BENTLEY_WORKFLOW_STORAGE_KEY);
      } catch {
        // quota
      }
      return raw;
    }
  } else {
    const raw = sessionStorage.getItem(BENTLEY_WORKFLOW_STORAGE_KEY);
    if (raw) return raw;
  }
  let raw = sessionStorage.getItem(BENTLEY_WORKFLOW_STORAGE_KEY_LEGACY);
  if (raw) {
    try {
      const k = scoped ?? BENTLEY_WORKFLOW_STORAGE_KEY;
      sessionStorage.setItem(k, raw);
      sessionStorage.removeItem(BENTLEY_WORKFLOW_STORAGE_KEY_LEGACY);
    } catch {
      // quota
    }
    return raw;
  }
  return null;
}

export type BentleyWorkflowPhaseId =
  | "intake"
  | "research"
  | "trends"
  | "market_sweep"
  | "content"
  | "campaign_notes"
  | "campaign_generation"
  | "media_brief"
  | "analysis"
  | "dashboard"
  | "launch_ready";

export type BentleyWorkflowArtifacts = {
  research?: ResearchResult | null;
  trends?: TrendsResponse | null;
  synthesis?: SynthesizePlanResult | null;
  /** Market Intelligence Sweep Engine (TikTok / YouTube / Reddit modeled signals). */
  marketSweep?: MarketSweepResult | null;
  contentEngine?: ContentEngineOutput | null;
  campaign?: CampaignResponse | null;
  mediaBriefText?: string | null;
  analysisComplete?: boolean;
  /** Latest operator-sent Bentley SLI → Content Bundle handoff (upstream market intelligence; not generated content). */
  bentleySliContentHandoff?: BentleyContentBundleHandoff | null;
  /** Set when generated campaign is upserted to `campaigns` (Bentley autonomous persistence). */
  bentleyDbCampaignId?: string | null;
  /** ISO timestamp after successful `sync-launch` (posts + schedule / approval UTM). */
  bentleyLaunchSyncedAt?: string | null;
  /** Populated when ensure-campaign failed; cleared when persistence succeeds. Avoids silent “complete” without DB id. */
  campaignPersistenceError?: string | null;
};

export type BentleyWorkflowState = {
  currentPhase: BentleyWorkflowPhaseId;
  completed: Partial<Record<BentleyWorkflowPhaseId, boolean>>;
  artifacts: BentleyWorkflowArtifacts;
  /** Post-analysis orchestration (persist → launch → analytics → optimization). */
  lifecycle?: BentleyLifecycleProgress;
  lastError?: string | null;
  /** Set when a pipeline step fails mid-run; cleared on the next successful phase completion. */
  lastFailedPhase?: BentleyWorkflowPhaseId | null;
  updatedAt: number;
};

const PHASE_ORDER: BentleyWorkflowPhaseId[] = [
  "intake",
  "research",
  "trends",
  "market_sweep",
  "content",
  "campaign_notes",
  "campaign_generation",
  "media_brief",
  "analysis",
  "dashboard",
  "launch_ready",
];

export function defaultWorkflowState(): BentleyWorkflowState {
  return {
    currentPhase: "intake",
    completed: {},
    artifacts: {},
    lastError: null,
    lastFailedPhase: null,
    updatedAt: Date.now(),
  };
}

export function loadWorkflowState(): BentleyWorkflowState {
  if (typeof window === "undefined") return defaultWorkflowState();
  try {
    const raw = readWorkflowRaw();
    if (!raw) return defaultWorkflowState();
    const j = JSON.parse(raw) as Partial<BentleyWorkflowState>;
    if (!j || typeof j !== "object") return defaultWorkflowState();
    return {
      ...defaultWorkflowState(),
      ...sanitizeBentleyWorkflowStateFromStorage(j),
    };
  } catch {
    return defaultWorkflowState();
  }
}

const WORKFLOW_SYNC_CHANNEL = "revenue-os:bentley-workflow-sync";

/** Broadcasts persisted workflow JSON so other tabs can mirror `sessionStorage` for the same scoped key. */
function broadcastWorkflowPersisted(storageKey: string, raw: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(WORKFLOW_SYNC_CHANNEL);
    bc.postMessage({ key: storageKey, raw });
    bc.close();
  } catch {
    // ignore
  }
}

/**
 * Subscribe to cross-tab workflow updates (same origin). Applies incoming payload when the key matches this tab’s active workflow key.
 */
export function subscribeBentleyWorkflowCrossTab(onUpdate: () => void): () => void {
  if (typeof BroadcastChannel === "undefined" || typeof window === "undefined") {
    return () => {};
  }
  const bc = new BroadcastChannel(WORKFLOW_SYNC_CHANNEL);
  bc.onmessage = (e: MessageEvent<{ key?: string; raw?: string }>) => {
    const activeKey = primaryWorkflowKey();
    if (e.data?.key !== activeKey || !e.data?.raw) return;
    try {
      sessionStorage.setItem(activeKey, e.data.raw);
      onUpdate();
    } catch {
      // quota
    }
  };
  return () => bc.close();
}

export function saveWorkflowState(state: BentleyWorkflowState): void {
  if (typeof window === "undefined") return;
  try {
    const persisted: BentleyWorkflowState = {
      ...state,
      artifacts: slimWorkflowArtifacts(state.artifacts),
      lifecycle: slimLifecycleProgress(state.lifecycle),
    };
    const raw = JSON.stringify({ ...persisted, updatedAt: Date.now() });
    const key = primaryWorkflowKey();
    sessionStorage.setItem(key, raw);
    broadcastWorkflowPersisted(key, raw);
    notifyBentleyWorkflowPersist(true);
    try {
      window.dispatchEvent(new CustomEvent("bentley-workflow-updated"));
    } catch {
      // ignore
    }
  } catch {
    notifyBentleyWorkflowPersist(false);
  }
}

export function markPhaseComplete(
  state: BentleyWorkflowState,
  phase: BentleyWorkflowPhaseId,
  patch?: Partial<BentleyWorkflowArtifacts>
): BentleyWorkflowState {
  const completed = { ...state.completed, [phase]: true };
  const artifacts = { ...state.artifacts, ...patch };
  const idx = PHASE_ORDER.indexOf(phase);
  const next = idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1]! : state.currentPhase;
  return {
    ...state,
    completed,
    artifacts,
    currentPhase: next,
    lastError: null,
    lastFailedPhase: null,
    updatedAt: Date.now(),
  };
}

export function setWorkflowError(
  state: BentleyWorkflowState,
  message: string,
  failedPhase?: BentleyWorkflowPhaseId | null
): BentleyWorkflowState {
  return {
    ...state,
    lastError: message,
    lastFailedPhase: failedPhase !== undefined ? failedPhase : state.lastFailedPhase ?? null,
    updatedAt: Date.now(),
  };
}

export function isPhaseComplete(state: BentleyWorkflowState, phase: BentleyWorkflowPhaseId): boolean {
  return Boolean(state.completed[phase]);
}

/** First phase in `PHASE_ORDER` without `completed[phase]` (resume / orchestration). */
export function getFirstIncompleteWorkflowPhase(state: BentleyWorkflowState): BentleyWorkflowPhaseId | null {
  for (const key of PHASE_ORDER) {
    if (!state.completed[key]) return key;
  }
  return null;
}

/**
 * Whether the automation pipeline can meaningfully resume (partial progress, failure, or error).
 * Used by ambient status / resume affordances — workflow is authoritative, not snapshot.pipeline alone.
 */
export function workflowShowsResumeablePartialRun(state: BentleyWorkflowState): boolean {
  if (state.lastFailedPhase != null) return true;
  if (coerceTrimmedString(state.lastError).length > 0) return true;
  const next = getFirstIncompleteWorkflowPhase(state);
  if (!next || next === "dashboard" || next === "launch_ready") return false;
  const ni = PHASE_ORDER.indexOf(next);
  if (ni <= 0) return false;
  return PHASE_ORDER.slice(0, ni).some((p) => Boolean(state.completed[p]));
}

/** Removes workflow JSON for every scope variant (and legacy unscoped rows). */
export function clearAllBentleyWorkflowSessionRows(): void {
  if (typeof window === "undefined") return;
  try {
    removeAllSessionKeysForLogicalBase(BENTLEY_WORKFLOW_STORAGE_KEY);
    removeAllSessionKeysForLogicalBase(BENTLEY_WORKFLOW_STORAGE_KEY_LEGACY);
  } catch {
    // ignore
  }
}

export function resetWorkflowState(): void {
  clearAllBentleyWorkflowSessionRows();
}
