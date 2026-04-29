/**
 * V2 auto-directing: explainable heuristics for layout recommendations (server truth; operator override wins).
 */

import type { BroadcastDirectingSignals } from "./broadcast-directing-signals";
import type { BroadcastLiveSceneType } from "./broadcast-live-scenes";
import type { BroadcastProviderHints } from "./broadcast-program";
import type { BroadcastLayoutMode } from "./broadcast-scene";
import { BROADCAST_LAYOUT_MODES } from "./broadcast-scene";

export const BROADCAST_AUTO_DIRECTING_MODES = ["off", "suggest_only", "auto_apply"] as const;
export type BroadcastAutoDirectingMode = (typeof BROADCAST_AUTO_DIRECTING_MODES)[number];

export type BroadcastAutoDirectingPolicy = {
  mode: BroadcastAutoDirectingMode;
  preferScreenShareFocus: boolean;
  preferPortraitLayouts: boolean;
  speakerSwitchDebounceMs: number;
  galleryParticipantThreshold: number;
  allowAutoReturnToProgramDefault: boolean;
};

export type BroadcastAutoDirectingDecision = {
  recommendedLayoutMode: BroadcastLayoutMode;
  reason: string;
  confidence: "low" | "medium" | "high";
  shouldApply: boolean;
};

export type BroadcastAutoDirectingDebounceState = {
  lastDominantSpeakerId: string | null;
  lastFlipAtIso: string | null;
};

export function getDefaultBroadcastAutoDirectingPolicy(): BroadcastAutoDirectingPolicy {
  return {
    mode: "off",
    preferScreenShareFocus: true,
    preferPortraitLayouts: true,
    speakerSwitchDebounceMs: 4500,
    galleryParticipantThreshold: 3,
    allowAutoReturnToProgramDefault: false,
  };
}

export function validateBroadcastAutoDirectingPolicy(
  input: unknown
): { ok: true; policy: BroadcastAutoDirectingPolicy } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const d = getDefaultBroadcastAutoDirectingPolicy();
  if (input == null || typeof input !== "object") {
    return { ok: true, policy: d };
  }
  const o = input as Record<string, unknown>;
  const mode = o.mode;
  if (mode != null) {
    const m = String(mode).trim() as BroadcastAutoDirectingMode;
    if (!BROADCAST_AUTO_DIRECTING_MODES.includes(m)) errors.push("invalid mode");
    else d.mode = m;
  }
  for (const [k, def] of [
    ["preferScreenShareFocus", d.preferScreenShareFocus],
    ["preferPortraitLayouts", d.preferPortraitLayouts],
    ["allowAutoReturnToProgramDefault", d.allowAutoReturnToProgramDefault],
  ] as const) {
    if (o[k] !== undefined && typeof o[k] !== "boolean") errors.push(`invalid ${k}`);
    else if (typeof o[k] === "boolean") (d as Record<string, boolean>)[k] = o[k] as boolean;
  }
  const deb = o.speakerSwitchDebounceMs;
  if (deb != null) {
    const n = Number(deb);
    if (!Number.isFinite(n) || n < 0 || n > 120_000) errors.push("invalid speakerSwitchDebounceMs");
    else d.speakerSwitchDebounceMs = Math.floor(n);
  }
  const th = o.galleryParticipantThreshold;
  if (th != null) {
    const n = Number(th);
    if (!Number.isFinite(n) || n < 1 || n > 50) errors.push("invalid galleryParticipantThreshold");
    else d.galleryParticipantThreshold = Math.floor(n);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, policy: d };
}

function isSpeakerish(l: BroadcastLayoutMode): boolean {
  return l === "speaker" || l === "portrait_speaker";
}

function msSince(iso: string | null, nowIso: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const a = Date.parse(iso);
  const b = Date.parse(nowIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return b - a;
}

/**
 * Raw layout target from heuristics (before debounce / equality checks).
 */
function pickRawRecommendedLayout(
  signals: BroadcastDirectingSignals,
  policy: BroadcastAutoDirectingPolicy,
  providerHints: BroadcastProviderHints
): { layout: BroadcastLayoutMode; reason: string; confidence: BroadcastAutoDirectingDecision["confidence"] } {
  if (signals.screenShareActive && policy.preferScreenShareFocus) {
    return { layout: "screenshare_focus", reason: "screen_share_active", confidence: "high" };
  }

  const multiSpeakers = signals.activeSpeakerIds.length > 1;
  const crowded =
    signals.participantCount >= policy.galleryParticipantThreshold || multiSpeakers;

  if (crowded && !signals.screenShareActive) {
    return { layout: "gallery", reason: "participant_or_speaker_count", confidence: signals.signalsWeak ? "low" : "medium" };
  }

  if (signals.dominantSpeakerId) {
    const portrait =
      policy.preferPortraitLayouts &&
      providerHints.anyPortraitCapable &&
      (signals.orientationHint === "portrait" || signals.orientationHint === undefined);
    const layout: BroadcastLayoutMode = portrait ? "portrait_speaker" : "speaker";
    return {
      layout,
      reason: portrait ? "single_dominant_portrait" : "single_dominant_speaker",
      confidence: signals.signalsWeak ? "low" : "medium",
    };
  }

  if (signals.participantCount <= 1 && signals.activeSpeakerIds.length <= 1) {
    return {
      layout: "portrait_speaker",
      reason: "minimal_participants_default_speaker",
      confidence: "low",
    };
  }

  return { layout: "gallery", reason: "fallback_gallery", confidence: "low" };
}

export function deriveBroadcastAutoDirectingDecision(
  signals: BroadcastDirectingSignals,
  currentSceneState: { sceneType: BroadcastLiveSceneType; layoutMode: BroadcastLayoutMode },
  policy: BroadcastAutoDirectingPolicy,
  providerHints: BroadcastProviderHints,
  debounce: BroadcastAutoDirectingDebounceState,
  nowIso: string
): BroadcastAutoDirectingDecision {
  if (currentSceneState.sceneType !== "program") {
    return {
      recommendedLayoutMode: currentSceneState.layoutMode,
      reason: "non_program_scene_hold",
      confidence: "medium",
      shouldApply: false,
    };
  }

  if (policy.mode === "off") {
    return {
      recommendedLayoutMode: currentSceneState.layoutMode,
      reason: "mode_off",
      confidence: "low",
      shouldApply: false,
    };
  }

  const raw = pickRawRecommendedLayout(signals, policy, providerHints);

  let recommended = raw.layout;
  if (!BROADCAST_LAYOUT_MODES.includes(recommended)) {
    recommended = "gallery";
  }

  let shouldApply = recommended !== currentSceneState.layoutMode;
  let reason = raw.reason;

  if (signals.signalsWeak && raw.confidence === "low" && !signals.screenShareActive) {
    shouldApply = false;
    reason = `${raw.reason}_signals_weak`;
  }

  const dom = signals.dominantSpeakerId?.trim() || null;
  if (shouldApply && isSpeakerish(recommended) && dom) {
    const aligned = debounce.lastDominantSpeakerId === dom;
    if (!aligned) {
      shouldApply = false;
      reason = "speaker_change_pending_debounce";
    } else if (msSince(debounce.lastFlipAtIso, nowIso) < policy.speakerSwitchDebounceMs) {
      shouldApply = false;
      reason = "speaker_debounce_window";
    }
  }

  return {
    recommendedLayoutMode: recommended,
    reason,
    confidence: raw.confidence,
    shouldApply,
  };
}

export const BROADCAST_AUTO_DIRECTING_MANUAL_OVERRIDE_DEFAULT_MS = 120_000;

export function defaultManualOverrideUntilIso(
  now: Date,
  durationMs = BROADCAST_AUTO_DIRECTING_MANUAL_OVERRIDE_DEFAULT_MS
): string {
  return new Date(now.getTime() + durationMs).toISOString();
}

export function isManualAutoDirectingOverrideActive(
  manualOverrideUntilIso: string | null | undefined,
  nowIso: string
): boolean {
  if (!manualOverrideUntilIso?.trim()) return false;
  const t = Date.parse(manualOverrideUntilIso);
  const n = Date.parse(nowIso);
  if (Number.isNaN(t) || Number.isNaN(n)) return false;
  return t > n;
}

export function shouldAutoApplyBroadcastDirectingDecision(params: {
  decision: BroadcastAutoDirectingDecision;
  policy: BroadcastAutoDirectingPolicy;
  manualOverrideUntilIso: string | null;
  nowIso: string;
}): boolean {
  if (params.policy.mode !== "auto_apply") return false;
  if (!params.decision.shouldApply) return false;
  if (params.manualOverrideUntilIso && Date.parse(params.manualOverrideUntilIso) > Date.parse(params.nowIso)) {
    return false;
  }
  return true;
}
