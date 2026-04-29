/**
 * Evaluates auto-directing on poll paths (V2 active only). Conservative: store failures do not break broadcast.
 */

import { broadcastAudit } from "./broadcast-audit";
import {
  deriveBroadcastAutoDirectingDecision,
  shouldAutoApplyBroadcastDirectingDecision,
  type BroadcastAutoDirectingDebounceState,
  type BroadcastAutoDirectingDecision,
} from "./broadcast-auto-directing";
import { buildBroadcastDirectingSignals } from "./broadcast-directing-signals";
import { validateBroadcastCompositorRenderModel } from "./broadcast-compositor";
import {
  publishAutoDirectingApplied,
  publishAutoDirectingDecision,
  publishAutoDirectingUpdated,
  publishLiveSceneUpdated,
} from "./broadcast-event-publisher";
import {
  ensureBroadcastLiveSceneStateForSession,
  getBroadcastLiveSceneState,
  upsertBroadcastLiveSceneState,
} from "./broadcast-live-scene-store";
import type { BroadcastLiveSceneState, MeetBroadcastSessionSceneSource } from "./broadcast-live-scenes";
import { isV2LiveSceneControlAvailable, mergeLiveScenePatch, validateLiveSceneState } from "./broadcast-live-scenes";
import {
  incrementBroadcastAutoDirectingApply,
  incrementBroadcastAutoDirectingDecision,
  incrementBroadcastAutoDirectingError,
} from "./broadcast-metrics";
import { getLatestBroadcastRenderSessionForBroadcast } from "./broadcast-render-sessions";
import {
  ensureBroadcastAutoDirectingStateForSession,
  getBroadcastAutoDirectingState,
  upsertBroadcastAutoDirectingState,
  type BroadcastAutoDirectingPersistedState,
} from "./broadcast-auto-directing-store";
import { publishBroadcastTimelineEventSafe } from "./broadcast-timeline-publisher";

export type SessionRow = Parameters<typeof isV2LiveSceneControlAvailable>[0] &
  MeetBroadcastSessionSceneSource & { roomId: string };

function syncDebounceWithSignals(
  prev: BroadcastAutoDirectingDebounceState,
  signals: ReturnType<typeof buildBroadcastDirectingSignals>,
  nowIso: string
): BroadcastAutoDirectingDebounceState {
  const dom = signals.dominantSpeakerId?.trim() || null;
  if (!dom) {
    return { lastDominantSpeakerId: null, lastFlipAtIso: null };
  }
  if (prev.lastDominantSpeakerId !== dom) {
    return { lastDominantSpeakerId: dom, lastFlipAtIso: nowIso };
  }
  return { lastDominantSpeakerId: prev.lastDominantSpeakerId, lastFlipAtIso: prev.lastFlipAtIso };
}

async function persistLayoutFromDecision(
  broadcastSessionId: number,
  session: SessionRow,
  ad: BroadcastAutoDirectingPersistedState,
  decision: BroadcastAutoDirectingDecision,
  live: BroadcastLiveSceneState,
  nowIso: string,
  source: "auto" | "manual"
): Promise<boolean> {
  const persistedLive = await getBroadcastLiveSceneState(broadcastSessionId);
  const baseLive = persistedLive ?? live;
  const merged = mergeLiveScenePatch(baseLive, {
    layoutMode: decision.recommendedLayoutMode,
    sceneType: "program",
  });
  const nextLive = {
    ...merged,
    updatedAt: nowIso,
    updatedByUserId: session.userId,
    broadcastSessionId,
  };
  const v = validateLiveSceneState(nextLive);
  if (!v.ok) return false;
  await upsertBroadcastLiveSceneState(v.state);
  const nextAd: BroadcastAutoDirectingPersistedState = {
    ...ad,
    lastAppliedAt: nowIso,
    lastAppliedLayoutMode: decision.recommendedLayoutMode,
    lastDecision: decision,
    updatedByUserId: session.userId,
  };
  await upsertBroadcastAutoDirectingState({
    broadcastSessionId,
    userId: session.userId,
    state: nextAd,
  });
  incrementBroadcastAutoDirectingApply({
    userId: session.userId,
    roomId: session.roomId,
    sessionId: broadcastSessionId,
    reason: source === "manual" ? "manual_apply" : decision.recommendedLayoutMode,
  });
  broadcastAudit("broadcast_auto_directing_applied", {
    broadcastSessionId,
    userId: session.userId,
    roomId: session.roomId,
    layoutMode: decision.recommendedLayoutMode,
    reason: decision.reason.slice(0, 200),
    source,
  });
  publishBroadcastTimelineEventSafe({
    broadcastSessionId,
    userId: session.userId,
    eventType: "auto_directing_applied",
    summary: source === "manual" ? "Auto-directing applied (manual)" : "Auto-directing applied",
    detailsJson: {
      layoutMode: decision.recommendedLayoutMode,
      source,
      reason: decision.reason.slice(0, 200),
    },
  });
  publishAutoDirectingApplied(broadcastSessionId, session.roomId, {
    layout: decision.recommendedLayoutMode,
    reason: decision.reason,
  });
  publishLiveSceneUpdated(broadcastSessionId, session.roomId);
  publishAutoDirectingUpdated(broadcastSessionId, session.roomId, {
    applied: true,
    manual: source === "manual",
  });
  return true;
}

export async function applyBroadcastAutoDirectingRecommendationManual(
  broadcastSessionId: number,
  session: SessionRow,
  nowIso: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ad = await getBroadcastAutoDirectingState(broadcastSessionId);
  if (!ad?.lastDecision) return { ok: false, error: "no_recommendation" };
  const live = await ensureBroadcastLiveSceneStateForSession(session);
  const ok = await persistLayoutFromDecision(broadcastSessionId, session, ad, ad.lastDecision, live, nowIso, "manual");
  if (!ok) return { ok: false, error: "persist_failed" };
  return { ok: true };
}

export async function evaluateBroadcastAutoDirectingForSession(
  broadcastSessionId: number,
  session: SessionRow,
  nowIso: string
): Promise<void> {
  if (!isV2LiveSceneControlAvailable(session)) return;

  try {
    const renderRow = await getLatestBroadcastRenderSessionForBroadcast(broadcastSessionId);
    const modelParsed = renderRow ? validateBroadcastCompositorRenderModel(renderRow.renderModelJson) : null;
    const model = modelParsed?.ok ? modelParsed.model : null;
    const signals = buildBroadcastDirectingSignals({ renderModel: model });

    const live = await ensureBroadcastLiveSceneStateForSession(session);
    let ad = await ensureBroadcastAutoDirectingStateForSession(broadcastSessionId, session.userId);

    const debounce = syncDebounceWithSignals(ad.debounce, signals, nowIso);
    ad = { ...ad, debounce };

    const hints = model?.providerHints ?? { platforms: [], anyPortraitCapable: false };
    const decision = deriveBroadcastAutoDirectingDecision(
      signals,
      { sceneType: live.sceneType, layoutMode: live.layoutMode },
      ad.policy,
      hints,
      debounce,
      nowIso
    );

    const prevReason = ad.lastDecision?.reason;
    const prevLayout = ad.lastDecision?.recommendedLayoutMode;

    ad = {
      ...ad,
      lastDecision: decision,
      updatedByUserId: session.userId,
    };

    await upsertBroadcastAutoDirectingState({
      broadcastSessionId,
      userId: session.userId,
      state: ad,
    });

    if (prevReason !== decision.reason || prevLayout !== decision.recommendedLayoutMode) {
      incrementBroadcastAutoDirectingDecision({
        userId: session.userId,
        roomId: session.roomId,
        sessionId: broadcastSessionId,
        reason: decision.reason.slice(0, 120),
      });
      publishAutoDirectingDecision(broadcastSessionId, session.roomId, {
        reason: decision.reason,
        layout: decision.recommendedLayoutMode,
        confidence: decision.confidence,
      });
      publishBroadcastTimelineEventSafe({
        broadcastSessionId,
        userId: session.userId,
        eventType: "auto_directing_decision",
        summary: `Suggest ${decision.recommendedLayoutMode}`,
        detailsJson: {
          recommendedLayoutMode: decision.recommendedLayoutMode,
          reason: decision.reason.slice(0, 300),
          confidence: decision.confidence,
        },
      });
    }

    const apply = shouldAutoApplyBroadcastDirectingDecision({
      decision,
      policy: ad.policy,
      manualOverrideUntilIso: ad.manualOverrideUntilIso,
      nowIso,
    });

    if (apply) {
      await persistLayoutFromDecision(broadcastSessionId, session, ad, decision, live, nowIso, "auto");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "engine_error";
    incrementBroadcastAutoDirectingError({
      userId: session.userId,
      roomId: session.roomId,
      sessionId: broadcastSessionId,
      reason: msg.slice(0, 120),
    });
    broadcastAudit("broadcast_auto_directing_invalid", {
      broadcastSessionId,
      userId: session.userId,
      roomId: session.roomId,
      errorSummary: msg,
    });
  }
}

export async function evaluateBroadcastAutoDirectingForActiveSession(session: SessionRow, nowIso: string): Promise<void> {
  await evaluateBroadcastAutoDirectingForSession(session.id, session, nowIso);
}
