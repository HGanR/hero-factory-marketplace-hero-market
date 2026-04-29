/**
 * Node-type room presets for venue interior nodes.
 * Lightweight config layer for the meet flow to consume.
 * Does not re-architect LiveKit; provides metadata for UI and room behavior hints.
 */

import type { VenueNodeType } from "@/types/venue-nodes";

export interface NodeTypePreset {
  nodeType: VenueNodeType;
  label: string;
  description: string;
  /** Suggested room mode for meet UI */
  roomMode: "voice" | "chat" | "presentation" | "stage" | "custom";
  /** Whether video is typically expected */
  videoExpected: boolean;
  /** Prefer speaker/stage mode (one main speaker) */
  speakerModePreferred: boolean;
  /** Prefer audience/listener mode */
  audienceModePreferred: boolean;
  /** Suggest screen-share/presentation mode */
  screenShareSuggested: boolean;
}

export const NODE_TYPE_PRESETS: Record<VenueNodeType, NodeTypePreset> = {
  voice_room: {
    nodeType: "voice_room",
    label: "Voice Room",
    description: "Voice discussion room for real-time audio conversation.",
    roomMode: "voice",
    videoExpected: false,
    speakerModePreferred: false,
    audienceModePreferred: false,
    screenShareSuggested: false,
  },
  chat_room: {
    nodeType: "chat_room",
    label: "Chat Room",
    description: "Open discussion room for text and voice chat.",
    roomMode: "chat",
    videoExpected: false,
    speakerModePreferred: false,
    audienceModePreferred: false,
    screenShareSuggested: false,
  },
  seminar_room: {
    nodeType: "seminar_room",
    label: "Seminar Room",
    description: "Seminar or presentation room with screen-share focus.",
    roomMode: "presentation",
    videoExpected: true,
    speakerModePreferred: true,
    audienceModePreferred: true,
    screenShareSuggested: true,
  },
  event_stage: {
    nodeType: "event_stage",
    label: "Event Stage",
    description: "Stage or event room with speaker and audience roles.",
    roomMode: "stage",
    videoExpected: true,
    speakerModePreferred: true,
    audienceModePreferred: true,
    screenShareSuggested: true,
  },
  concert_hall: {
    nodeType: "concert_hall",
    label: "Concert Hall",
    description: "Large venue for performances and events.",
    roomMode: "stage",
    videoExpected: true,
    speakerModePreferred: true,
    audienceModePreferred: true,
    screenShareSuggested: false,
  },
  custom: {
    nodeType: "custom",
    label: "Custom",
    description: "Custom room with flexible behavior.",
    roomMode: "custom",
    videoExpected: false,
    speakerModePreferred: false,
    audienceModePreferred: false,
    screenShareSuggested: false,
  },
};

/** Get preset for a node type; falls back to custom if unknown */
export function getNodeTypePreset(nodeType: string): NodeTypePreset {
  return NODE_TYPE_PRESETS[nodeType as VenueNodeType] ?? NODE_TYPE_PRESETS.custom;
}

/** Human-readable room behavior summary for meet UI */
export function getRoomBehaviorSummary(nodeType: string): string {
  const preset = getNodeTypePreset(nodeType);
  switch (preset.roomMode) {
    case "voice":
      return "Voice discussion room";
    case "chat":
      return "Open discussion room";
    case "presentation":
      return "Seminar / presentation room";
    case "stage":
      return "Stage / event room";
    default:
      return preset.label;
  }
}
