/**
 * Room-level hints for V2 auto-directing. Derived from the frozen compositor snapshot (and optional future live room sync).
 *
 * Limitation: participant graph is only as fresh as the render-session snapshot; without LiveKit server webhooks,
 * counts and speakers may lag until the next snapshot refresh path.
 */

import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";
import type { MeetRoomStateLite } from "./broadcast-program";

export type BroadcastDirectingSignals = {
  activeSpeakerIds: string[];
  dominantSpeakerId?: string;
  participantCount: number;
  screenShareActive: boolean;
  recentlyChangedAtIso?: string;
  orientationHint?: "portrait" | "landscape";
  /** True when participant data is empty — heuristics should stay conservative. */
  signalsWeak: boolean;
};

export type BroadcastDirectingRoomStateInput = {
  /** Optional richer room snapshot when available (future / tests). */
  meetRoom?: MeetRoomStateLite | null;
  /** Compositor model from latest render session merge path. */
  renderModel?: BroadcastCompositorRenderModel | null;
};

export function buildBroadcastDirectingSignals(input: BroadcastDirectingRoomStateInput): BroadcastDirectingSignals {
  const meet = input.meetRoom;
  const model = input.renderModel;

  const fromMeet =
    meet &&
    (meet.participantIds.length > 0 || meet.primarySpeakerId || meet.screenShareTrackPublished);

  if (fromMeet && meet) {
    const ids = [...new Set(meet.participantIds.filter(Boolean))];
    const activeSpeakerIds = meet.primarySpeakerId && ids.includes(meet.primarySpeakerId)
      ? [meet.primarySpeakerId]
      : ids.slice(0, 4);
    return normalizeBroadcastDirectingSignals({
      activeSpeakerIds,
      dominantSpeakerId: meet.primarySpeakerId ?? undefined,
      participantCount: Math.max(ids.length, activeSpeakerIds.length ? 1 : 0),
      screenShareActive: Boolean(meet.screenShareTrackPublished),
      orientationHint: undefined,
      signalsWeak: ids.length === 0 && !meet.screenShareTrackPublished,
    });
  }

  if (model) {
    const ids = [...new Set(model.highlightedParticipantIds.filter(Boolean))];
    const dom = model.primarySpeakerId?.trim() || undefined;
    const active = dom && ids.includes(dom) ? [dom] : ids.length ? ids : dom ? [dom] : [];
    const pc = Math.max(ids.length, active.length, dom ? 1 : 0);
    const orient =
      model.orientation === "portrait" || model.orientation === "landscape" ? model.orientation : undefined;
    return normalizeBroadcastDirectingSignals({
      activeSpeakerIds: active,
      dominantSpeakerId: dom,
      participantCount: pc,
      screenShareActive: model.screenShareActive,
      orientationHint: orient,
      signalsWeak: pc === 0 && !model.screenShareActive,
    });
  }

  return normalizeBroadcastDirectingSignals({
    activeSpeakerIds: [],
    participantCount: 0,
    screenShareActive: false,
    signalsWeak: true,
  });
}

export function normalizeBroadcastDirectingSignals(partial: Partial<BroadcastDirectingSignals>): BroadcastDirectingSignals {
  const activeSpeakerIds = [...new Set((partial.activeSpeakerIds ?? []).filter(Boolean).map((s) => s.trim()))].slice(
    0,
    16
  );
  const dom = partial.dominantSpeakerId?.trim() || undefined;
  const participantCount = Math.max(
    0,
    Math.min(500, Number.isFinite(partial.participantCount as number) ? Number(partial.participantCount) : 0)
  );
  const screenShareActive = Boolean(partial.screenShareActive);
  const recentlyChangedAtIso =
    typeof partial.recentlyChangedAtIso === "string" && !Number.isNaN(Date.parse(partial.recentlyChangedAtIso))
      ? partial.recentlyChangedAtIso
      : undefined;
  const orientationHint =
    partial.orientationHint === "portrait" || partial.orientationHint === "landscape"
      ? partial.orientationHint
      : undefined;
  const signalsWeak = Boolean(partial.signalsWeak ?? (participantCount === 0 && !screenShareActive && !dom));
  return {
    activeSpeakerIds,
    dominantSpeakerId: dom,
    participantCount,
    screenShareActive,
    recentlyChangedAtIso,
    orientationHint,
    signalsWeak,
  };
}

/** Safe JSON summary for render-session / status (no PII beyond participant ids already on model). */
export function buildDirectingSignalsPublicSummary(signals: BroadcastDirectingSignals): {
  participantCount: number;
  screenShareActive: boolean;
  dominantSpeakerId: string | null;
  activeSpeakerCount: number;
  signalsWeak: boolean;
  orientationHint: "portrait" | "landscape" | null;
} {
  return {
    participantCount: signals.participantCount,
    screenShareActive: signals.screenShareActive,
    dominantSpeakerId: signals.dominantSpeakerId ?? null,
    activeSpeakerCount: signals.activeSpeakerIds.length,
    signalsWeak: signals.signalsWeak,
    orientationHint: signals.orientationHint ?? null,
  };
}

export function validateBroadcastDirectingSignals(
  input: unknown
): { ok: true; signals: BroadcastDirectingSignals } | { ok: false; errors: string[] } {
  if (input == null || typeof input !== "object") {
    return { ok: false, errors: ["signals must be an object"] };
  }
  const o = input as Record<string, unknown>;
  const errors: string[] = [];
  if (o.activeSpeakerIds != null && !Array.isArray(o.activeSpeakerIds)) errors.push("invalid activeSpeakerIds");
  if (o.dominantSpeakerId != null && typeof o.dominantSpeakerId !== "string") errors.push("invalid dominantSpeakerId");
  if (o.participantCount != null && (typeof o.participantCount !== "number" || !Number.isFinite(o.participantCount))) {
    errors.push("invalid participantCount");
  }
  if (o.screenShareActive != null && typeof o.screenShareActive !== "boolean") errors.push("invalid screenShareActive");
  if (errors.length) return { ok: false, errors };
  const signals = normalizeBroadcastDirectingSignals({
    activeSpeakerIds: (o.activeSpeakerIds as string[]) ?? [],
    dominantSpeakerId: o.dominantSpeakerId as string | undefined,
    participantCount: o.participantCount as number | undefined,
    screenShareActive: o.screenShareActive as boolean | undefined,
    recentlyChangedAtIso: o.recentlyChangedAtIso as string | undefined,
    orientationHint: o.orientationHint as BroadcastDirectingSignals["orientationHint"],
    signalsWeak: o.signalsWeak as boolean | undefined,
  });
  return { ok: true, signals };
}
