/**
 * V2 broadcast compositor: render model consumed by the LiveKit room-composite custom template.
 */

import type { BroadcastSceneConfig, BroadcastLayoutMode } from "./broadcast-scene";
import { mapBroadcastSceneToLiveKitLayout } from "./broadcast-scene";
import type { BroadcastProgramState } from "./broadcast-program";
import { getProviderCapabilities } from "@/lib/streaming/provider-capabilities";

export type BroadcastCompositorMode = "v1_livekit_default" | "v2_rendered_template";

export type LiveKitCompositeLayout = "grid" | "speaker" | "single-speaker";

export type BroadcastCompositorRenderModel = {
  layoutMode: BroadcastLayoutMode;
  liveKitLayout: LiveKitCompositeLayout;
  portraitSafe: boolean;
  branding: BroadcastSceneConfig["branding"];
  showParticipantNames: boolean;
  showMutedIndicators: boolean;
  showFooter: boolean;
  highlightedParticipantIds: string[];
  primarySpeakerId: string | null;
  screenShareActive: boolean;
  programNotes: string[];
  orientation: "portrait" | "landscape" | "auto";
  providerHints: BroadcastProgramState["providerHints"];
  /**
   * V2 template only: operator live scene slates (intro/brb/outro/holding). Omitted on snapshots that predate live scenes.
   * `program` means normal participant composite; template still polls this field for metadata.
   */
  egressLiveSceneType?: "program" | "intro" | "brb" | "outro" | "holding";
  liveSceneHeadline?: string | null;
  liveSceneSubheadline?: string | null;
  /** V2 template: operator overlays (lower third, ticker, CTA). Omitted when not merged. */
  overlays?: import("./broadcast-overlays").BroadcastOverlayRenderPayload;
  /** V2 template: countdown from schedule (polling). */
  countdown?: import("./broadcast-schedule").BroadcastCountdownRenderPayload;
};

export type CompositorFeatureFlags = {
  globalEnabled: boolean;
  userEnabled: boolean;
};

export function shouldUseRenderedCompositor(
  _sceneConfig: BroadcastSceneConfig,
  flags: CompositorFeatureFlags
): boolean {
  void _sceneConfig;
  return flags.globalEnabled || flags.userEnabled;
}

export function buildBroadcastCompositorRenderModel(
  sceneConfig: BroadcastSceneConfig,
  programState: BroadcastProgramState,
  destinationSummary: { platforms: string[] }
): BroadcastCompositorRenderModel {
  const { liveKitLayout } = mapBroadcastSceneToLiveKitLayout(sceneConfig.layoutMode);
  const anyPortraitCapable = destinationSummary.platforms.some(
    (p) => getProviderCapabilities(p).supportsPortrait
  );
  const orientation: "portrait" | "landscape" | "auto" =
    sceneConfig.portraitSafe || sceneConfig.layoutMode.startsWith("portrait_")
      ? "portrait"
      : anyPortraitCapable
        ? "auto"
        : "landscape";

  return {
    layoutMode: sceneConfig.layoutMode,
    liveKitLayout,
    portraitSafe: sceneConfig.portraitSafe,
    branding: { ...sceneConfig.branding },
    showParticipantNames: sceneConfig.showParticipantNames,
    showMutedIndicators: sceneConfig.showMutedIndicators,
    showFooter: sceneConfig.showFooter,
    highlightedParticipantIds: [...programState.highlightedParticipantIds],
    primarySpeakerId: programState.primarySpeakerId ?? null,
    screenShareActive: programState.screenShareActive,
    programNotes: [...programState.programNotes],
    orientation,
    providerHints: {
      platforms: [...destinationSummary.platforms],
      anyPortraitCapable,
    },
  };
}

export function validateBroadcastCompositorRenderModel(
  model: unknown
): { ok: true; model: BroadcastCompositorRenderModel } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (model == null || typeof model !== "object") {
    return { ok: false, errors: ["model must be an object"] };
  }
  const m = model as Record<string, unknown>;
  const lk = m.liveKitLayout;
  if (lk !== "grid" && lk !== "speaker" && lk !== "single-speaker") {
    errors.push("invalid liveKitLayout");
  }
  const ori = m.orientation;
  if (ori !== "portrait" && ori !== "landscape" && ori !== "auto") {
    errors.push("invalid orientation");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, model: model as BroadcastCompositorRenderModel };
}
