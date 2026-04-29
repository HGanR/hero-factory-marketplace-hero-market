import type { BroadcastLayoutMode } from "./broadcast-scene";
import { getProviderCapabilities } from "@/lib/streaming/provider-capabilities";

export type DestinationPlatformHint = { platform: string };

/**
 * Suggest a scene layout from saved destinations (portrait-first platforms → portrait layouts).
 */
export function suggestSceneLayoutForDestinations(destinations: DestinationPlatformHint[]): BroadcastLayoutMode {
  if (!destinations.length) return "gallery";

  let anyPortrait = false;
  let anyLandscape = false;
  for (const d of destinations) {
    const c = getProviderCapabilities(d.platform);
    if (c.supportsPortrait) anyPortrait = true;
    else anyLandscape = true;
  }

  if (anyPortrait && !anyLandscape) return "portrait_speaker";
  if (anyPortrait && anyLandscape) return "portrait_split";
  /** Landscape-first destinations (Twitch, Facebook, custom RTMP): talking-head default; host can switch to screenshare_focus in UI. */
  if (anyLandscape) return "speaker";
  return "speaker";
}

export function suggestPortraitSafeForDestinations(destinations: DestinationPlatformHint[]): boolean {
  return destinations.some((d) => getProviderCapabilities(d.platform).supportsPortrait);
}
