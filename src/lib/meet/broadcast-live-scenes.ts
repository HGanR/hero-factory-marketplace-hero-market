/**
 * V2-only live scene operator model (server truth + polling). V1 compositor ignores this layer.
 *
 * Limitations (this phase):
 * - Live scene control applies only when compositorMode === v2_rendered_template (no fallback).
 * - Updates are eventually consistent: status panel polls ~4s; template polls render-session ~3s (see BroadcastEgressTemplateClient).
 * - No frame-perfect cuts and no egress restart on scene change.
 */

import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";
import { buildBroadcastCompositorRenderModel, validateBroadcastCompositorRenderModel } from "./broadcast-compositor";
import type { BroadcastProgramState, MeetRoomStateLite } from "./broadcast-program";
import { buildBroadcastProgramState } from "./broadcast-program";
import {
  BROADCAST_LAYOUT_MODES,
  mapBroadcastSceneToLiveKitLayout,
  type BroadcastBranding,
  type BroadcastLayoutMode,
  type BroadcastSceneConfig,
  parseStoredSceneSnapshot,
} from "./broadcast-scene";

export const BROADCAST_LIVE_SCENE_TYPES = ["program", "intro", "brb", "outro", "holding"] as const;
export type BroadcastLiveSceneType = (typeof BROADCAST_LIVE_SCENE_TYPES)[number];

export type BroadcastLiveSceneState = {
  broadcastSessionId: number;
  sceneType: BroadcastLiveSceneType;
  layoutMode: BroadcastLayoutMode;
  branding: BroadcastBranding;
  showParticipantNames: boolean;
  showMutedIndicators: boolean;
  showFooter: boolean;
  portraitSafe: boolean;
  screenSharePriority: boolean;
  customHeadline?: string;
  customSubheadline?: string;
  updatedAt: string;
  updatedByUserId: number;
};

export type MeetBroadcastSessionSceneSource = {
  id: number;
  userId: number;
  sceneConfigJson: unknown;
  layoutMode: string;
};

/** Live scene APIs and template merge apply only for active V2 rendered compositor sessions (not V1 fallback). */
export function isV2LiveSceneControlAvailable(session: {
  status: string;
  compositorMode: string | null;
  renderSessionId: number | null;
  compositorFallbackFromV2: boolean;
}): boolean {
  const live = session.status === "starting" || session.status === "active";
  return (
    live &&
    (session.compositorMode ?? "v1_livekit_default") === "v2_rendered_template" &&
    session.renderSessionId != null &&
    !session.compositorFallbackFromV2
  );
}

const HEADLINE_MAX = 240;
const SUB_MAX = 400;

export function defaultLiveSceneCopy(sceneType: BroadcastLiveSceneType): { headline: string; subheadline: string } {
  switch (sceneType) {
    case "intro":
      return { headline: "Welcome", subheadline: "We're about to begin" };
    case "brb":
      return { headline: "Be Right Back", subheadline: "Please stand by" };
    case "outro":
      return { headline: "Thank you", subheadline: "This broadcast has ended" };
    case "holding":
      return { headline: "Stand by", subheadline: "Starting shortly" };
    default:
      return { headline: "", subheadline: "" };
  }
}

export function getDefaultLiveSceneStateFromSession(
  session: MeetBroadcastSessionSceneSource,
  updatedByUserId: number
): BroadcastLiveSceneState {
  const snap = parseStoredSceneSnapshot(session.sceneConfigJson, session.layoutMode);
  return {
    broadcastSessionId: session.id,
    sceneType: "program",
    layoutMode: snap.layoutMode,
    branding: { ...snap.branding },
    showParticipantNames: snap.showParticipantNames,
    showMutedIndicators: snap.showMutedIndicators,
    showFooter: snap.showFooter,
    portraitSafe: snap.portraitSafe,
    screenSharePriority: snap.screenSharePriority,
    updatedAt: new Date().toISOString(),
    updatedByUserId,
  };
}

export function sceneConfigFromLiveState(s: BroadcastLiveSceneState): BroadcastSceneConfig {
  return {
    layoutMode: s.layoutMode,
    branding: { ...s.branding },
    showParticipantNames: s.showParticipantNames,
    showMutedIndicators: s.showMutedIndicators,
    showFooter: s.showFooter,
    portraitSafe: s.portraitSafe,
    screenSharePriority: s.screenSharePriority,
  };
}

function isLiveSceneType(v: unknown): v is BroadcastLiveSceneType {
  return typeof v === "string" && (BROADCAST_LIVE_SCENE_TYPES as readonly string[]).includes(v);
}

function isLayoutMode(v: unknown): v is BroadcastLayoutMode {
  return typeof v === "string" && (BROADCAST_LAYOUT_MODES as readonly string[]).includes(v);
}

function trimOptStr(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

/**
 * Validate a full persisted state object (after patch merge).
 */
export function validateLiveSceneState(
  input: unknown
): { ok: true; state: BroadcastLiveSceneState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input == null || typeof input !== "object") {
    return { ok: false, errors: ["state must be an object"] };
  }
  const o = input as Record<string, unknown>;
  const id = o.broadcastSessionId;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    errors.push("invalid broadcastSessionId");
  }
  if (!isLiveSceneType(o.sceneType)) errors.push("invalid sceneType");
  if (!isLayoutMode(o.layoutMode)) errors.push("invalid layoutMode");
  const branding = o.branding;
  if (branding != null && typeof branding !== "object") {
    errors.push("invalid branding");
  }
  for (const k of ["showParticipantNames", "showMutedIndicators", "showFooter", "portraitSafe", "screenSharePriority"]) {
    if (o[k] !== undefined && typeof o[k] !== "boolean") {
      errors.push(`invalid ${k}`);
    }
  }
  const uid = o.updatedByUserId;
  if (typeof uid !== "number" || !Number.isFinite(uid) || uid <= 0) {
    errors.push("invalid updatedByUserId");
  }
  const updatedAt = o.updatedAt;
  if (typeof updatedAt !== "string" || !updatedAt.trim()) {
    errors.push("invalid updatedAt");
  }
  const ch = trimOptStr(o.customHeadline, HEADLINE_MAX);
  const cs = trimOptStr(o.customSubheadline, SUB_MAX);
  if (o.customHeadline !== undefined && o.customHeadline !== null && typeof o.customHeadline !== "string") {
    errors.push("invalid customHeadline");
  }
  if (o.customSubheadline !== undefined && o.customSubheadline !== null && typeof o.customSubheadline !== "string") {
    errors.push("invalid customSubheadline");
  }
  if (errors.length) return { ok: false, errors };
  const b = (branding ?? {}) as Record<string, unknown>;
  const brandingOut: BroadcastBranding = {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl.slice(0, 2048) : undefined,
    brandName: typeof b.brandName === "string" ? b.brandName.slice(0, 200) : undefined,
    footerText: typeof b.footerText === "string" ? b.footerText.slice(0, 500) : undefined,
    accentHex: typeof b.accentHex === "string" ? b.accentHex.slice(0, 32) : undefined,
  };
  return {
    ok: true,
    state: {
      broadcastSessionId: id as number,
      sceneType: o.sceneType as BroadcastLiveSceneType,
      layoutMode: o.layoutMode as BroadcastLayoutMode,
      branding: brandingOut,
      showParticipantNames: Boolean(o.showParticipantNames),
      showMutedIndicators: Boolean(o.showMutedIndicators),
      showFooter: Boolean(o.showFooter),
      portraitSafe: Boolean(o.portraitSafe),
      screenSharePriority: Boolean(o.screenSharePriority),
      customHeadline: ch,
      customSubheadline: cs,
      updatedAt: String(updatedAt),
      updatedByUserId: uid as number,
    },
  };
}

export type LiveScenePatch = Partial<
  Pick<
    BroadcastLiveSceneState,
    | "sceneType"
    | "layoutMode"
    | "branding"
    | "showParticipantNames"
    | "showMutedIndicators"
    | "showFooter"
    | "portraitSafe"
    | "screenSharePriority"
    | "customHeadline"
    | "customSubheadline"
  >
>;

/**
 * Merge server defaults with an operator PATCH. Does not set updatedAt / updatedByUserId.
 */
export function mergeLiveScenePatch(base: BroadcastLiveSceneState, patch: LiveScenePatch): BroadcastLiveSceneState {
  const next: BroadcastLiveSceneState = {
    ...base,
    branding: { ...base.branding, ...(patch.branding ?? {}) },
  };
  if (patch.sceneType !== undefined) next.sceneType = patch.sceneType;
  if (patch.layoutMode !== undefined) next.layoutMode = patch.layoutMode;
  if (patch.showParticipantNames !== undefined) next.showParticipantNames = patch.showParticipantNames;
  if (patch.showMutedIndicators !== undefined) next.showMutedIndicators = patch.showMutedIndicators;
  if (patch.showFooter !== undefined) next.showFooter = patch.showFooter;
  if (patch.portraitSafe !== undefined) next.portraitSafe = patch.portraitSafe;
  if (patch.screenSharePriority !== undefined) next.screenSharePriority = patch.screenSharePriority;
  if (patch.customHeadline !== undefined) {
    next.customHeadline = patch.customHeadline === null || patch.customHeadline === "" ? undefined : patch.customHeadline;
  }
  if (patch.customSubheadline !== undefined) {
    next.customSubheadline =
      patch.customSubheadline === null || patch.customSubheadline === "" ? undefined : patch.customSubheadline;
  }
  return next;
}

function programStateFromBaseModel(base: BroadcastCompositorRenderModel): BroadcastProgramState {
  return {
    layoutMode: base.layoutMode,
    portraitSafe: base.portraitSafe,
    branding: base.branding,
    primarySpeakerId: base.primarySpeakerId,
    highlightedParticipantIds: [...base.highlightedParticipantIds],
    screenShareActive: base.screenShareActive,
    programNotes: [...base.programNotes],
    providerHints: {
      platforms: [...base.providerHints.platforms],
      anyPortraitCapable: base.providerHints.anyPortraitCapable,
    },
  };
}

function resolvedHeadlinesForSlate(live: BroadcastLiveSceneState): { headline: string | null; subheadline: string | null } {
  const def = defaultLiveSceneCopy(live.sceneType);
  const h = live.customHeadline?.trim() ? live.customHeadline.trim().slice(0, HEADLINE_MAX) : def.headline || null;
  const s = live.customSubheadline?.trim()
    ? live.customSubheadline.trim().slice(0, SUB_MAX)
    : def.subheadline || null;
  return { headline: h, subheadline: s };
}

/**
 * Build a fresh compositor model from live scene + program state (used in tests and tooling).
 */
export function buildLiveSceneRenderModel(
  sceneState: BroadcastLiveSceneState,
  programState: BroadcastProgramState,
  destinationSummary: { platforms: string[] }
): BroadcastCompositorRenderModel {
  const sceneCfg = sceneConfigFromLiveState(sceneState);
  const base = buildBroadcastCompositorRenderModel(sceneCfg, programState, destinationSummary);
  if (sceneState.sceneType === "program") {
    return { ...base, egressLiveSceneType: "program", liveSceneHeadline: null, liveSceneSubheadline: null };
  }
  const { headline, subheadline } = resolvedHeadlinesForSlate(sceneState);
  return {
    ...base,
    egressLiveSceneType: sceneState.sceneType,
    liveSceneHeadline: headline,
    liveSceneSubheadline: subheadline,
    highlightedParticipantIds: [],
    primarySpeakerId: null,
    screenShareActive: false,
    programNotes: [],
  };
}

/**
 * Merge frozen render-session snapshot with effective live scene state for egress template polling.
 * Program scene: recomputes layout/orientation from live overrides while preserving participant snapshot fields from base.
 * Non-program: slate model (no participant dependency); still joins LiveKit room for egress.
 */
export function mergeBaseRenderModelWithLiveScene(
  baseModel: unknown,
  liveState: BroadcastLiveSceneState
):
  | { ok: true; model: BroadcastCompositorRenderModel; liveSceneMeta: BroadcastLiveSceneState }
  | { ok: false; errors: string[] } {
  const v = validateBroadcastCompositorRenderModel(baseModel);
  if (!v.ok) return v;
  const base = v.model;
  const platforms = base.providerHints?.platforms ?? [];
  const destSummary = { platforms };

  if (liveState.sceneType === "program") {
    const sceneCfg = sceneConfigFromLiveState(liveState);
    const ps = programStateFromBaseModel(base);
    const merged = buildBroadcastCompositorRenderModel(sceneCfg, ps, destSummary);
    return {
      ok: true,
      model: {
        ...merged,
        egressLiveSceneType: "program",
        liveSceneHeadline: null,
        liveSceneSubheadline: null,
      },
      liveSceneMeta: liveState,
    };
  }

  const sceneCfg = sceneConfigFromLiveState(liveState);
  const emptyRoom: MeetRoomStateLite = { participantIds: [], screenShareTrackPublished: false, primarySpeakerId: null };
  const ps = buildBroadcastProgramState(sceneCfg, emptyRoom, base.providerHints);
  let merged = buildBroadcastCompositorRenderModel(sceneCfg, ps, destSummary);
  const { headline, subheadline } = resolvedHeadlinesForSlate(liveState);
  merged = {
    ...merged,
    egressLiveSceneType: liveState.sceneType,
    liveSceneHeadline: headline,
    liveSceneSubheadline: subheadline,
    highlightedParticipantIds: [],
    primarySpeakerId: null,
    screenShareActive: false,
    programNotes: [],
  };
  return { ok: true, model: merged, liveSceneMeta: liveState };
}

/** Map product layout to LiveKit composite layout string for the template (query param). */
export function liveKitLayoutParamForLiveScene(liveState: BroadcastLiveSceneState): string {
  const { liveKitLayout } = mapBroadcastSceneToLiveKitLayout(liveState.layoutMode);
  return liveKitLayout;
}
