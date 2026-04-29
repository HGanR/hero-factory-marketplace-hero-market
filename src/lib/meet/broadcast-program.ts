import type { BroadcastBranding, BroadcastLayoutMode, BroadcastSceneConfig } from "./broadcast-scene";

/** Minimal room snapshot for V1 program metadata; auto-directing uses compositor snapshot until live room sync exists. */
export type MeetRoomStateLite = {
  primarySpeakerId?: string | null;
  participantIds: string[];
  screenShareTrackPublished?: boolean;
};

export type BroadcastProviderHints = {
  platforms: string[];
  anyPortraitCapable: boolean;
};

export type BroadcastProgramState = {
  layoutMode: BroadcastLayoutMode;
  portraitSafe: boolean;
  branding: BroadcastBranding;
  primarySpeakerId?: string | null;
  highlightedParticipantIds: string[];
  screenShareActive: boolean;
  programNotes: string[];
  providerHints: BroadcastProviderHints;
};

export function deriveHighlightedParticipants(
  sceneConfig: BroadcastSceneConfig,
  roomState: MeetRoomStateLite
): string[] {
  const ids = [...new Set(roomState.participantIds.filter(Boolean))];
  if (sceneConfig.screenSharePriority && roomState.screenShareTrackPublished) {
    const sharers = ids.slice(0, 3);
    return sharers.length ? sharers : ids.slice(0, 1);
  }
  if (roomState.primarySpeakerId && ids.includes(roomState.primarySpeakerId)) {
    return [roomState.primarySpeakerId];
  }
  return ids.slice(0, 1);
}

export function deriveProgramNotes(sceneConfig: BroadcastSceneConfig, roomState: MeetRoomStateLite): string[] {
  const notes: string[] = [];
  if (sceneConfig.portraitSafe) {
    notes.push("Portrait-safe framing intent is on; without V2 template, egress uses standard LiveKit composites.");
  }
  if (sceneConfig.screenSharePriority && roomState.screenShareTrackPublished) {
    notes.push("Screen share detected — priority intent for compositor routing (V2 template honors screenshare_focus).");
  }
  if (sceneConfig.showFooter && sceneConfig.branding.footerText) {
    notes.push("Footer text is rendered on the program chrome when V2 template is active.");
  }
  return notes;
}

export function buildBroadcastProgramState(
  sceneConfig: BroadcastSceneConfig,
  roomState: MeetRoomStateLite,
  providerHints?: BroadcastProviderHints
): BroadcastProgramState {
  const hints = providerHints ?? { platforms: [], anyPortraitCapable: false };
  return {
    layoutMode: sceneConfig.layoutMode,
    portraitSafe: sceneConfig.portraitSafe,
    branding: sceneConfig.branding,
    primarySpeakerId: roomState.primarySpeakerId ?? null,
    highlightedParticipantIds: deriveHighlightedParticipants(sceneConfig, roomState),
    screenShareActive: Boolean(roomState.screenShareTrackPublished),
    programNotes: deriveProgramNotes(sceneConfig, roomState),
    providerHints: hints,
  };
}
