/**
 * Publishing connector matrix for Bentley distribution routing (OAuth-linked accounts).
 */

import type { SocialPlatform } from "@/lib/social/config";

export type ConnectedPublishingProfile = {
  platform: SocialPlatform;
  profileId: string;
  profileName: string;
  isConnected: boolean;
  canPublish: boolean;
  canSchedule: boolean;
  supportedFormats: string[];
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsCaption: boolean;
  supportsFirstComment: boolean | null;
  supportsLinkInCaption: boolean | null;
  supportsShortForm: boolean;
  supportsLongForm: boolean;
  platformConstraints: Record<string, unknown>;
};

export type PublishingCapabilityMatrix = {
  profiles: ConnectedPublishingProfile[];
  connectedPlatforms: string[];
  platformsWithAutoPublish: string[];
  platformsManualOnly: string[];
  summaryLine: string;
};

export function normalizeRoutingPlatform(raw: string | null | undefined): SocialPlatform | "youtube" | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook")) return "facebook";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("pinterest")) return "pinterest";
  if (s.includes("snapchat")) return "snapchat";
  if (s === "x" || s.includes("twitter")) return "x";
  if (s.includes("youtube")) return "youtube";
  return null;
}

export function profileForPlatform(
  profiles: ConnectedPublishingProfile[],
  platform: SocialPlatform | "youtube",
): ConnectedPublishingProfile | null {
  if (platform === "youtube") return null;
  return profiles.find((p) => p.platform === platform) ?? null;
}

export function getPublishingCapabilityMatrix(profiles: ConnectedPublishingProfile[]): PublishingCapabilityMatrix {
  const connectedPlatforms = [...new Set(profiles.map((p) => p.platform))];
  const platformsWithAutoPublish = profiles.filter((p) => p.canPublish).map((p) => p.platform);
  const platformsManualOnly = profiles.filter((p) => p.isConnected && !p.canPublish).map((p) => p.platform);
  const summaryLine =
    profiles.length === 0
      ? "No OAuth publishing connectors linked for this workspace yet."
      : `${profiles.length} connected profile(s); ${platformsWithAutoPublish.length} ready for auto-publish.`;
  return {
    profiles,
    connectedPlatforms,
    platformsWithAutoPublish,
    platformsManualOnly,
    summaryLine,
  };
}

/** Loads OAuth-linked publishing profiles for a workspace (empty until adapter wiring). */
export async function getConnectedPublishingProfiles(_input: {
  userId: string;
  clientId: string;
  trustId?: string;
}): Promise<ConnectedPublishingProfile[]> {
  return [];
}
