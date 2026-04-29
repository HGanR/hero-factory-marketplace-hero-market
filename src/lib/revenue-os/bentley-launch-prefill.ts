import type { SocialPlatform } from "@/lib/social/config";
import type { BentleyLaunchPrefill, BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";

/**
 * Maps a Bentley snapshot (from context or `readCanonicalBentleySnapshot`) into Campaign Launch props.
 * OAuth / connect `postingTargets` are **not** derived here — they stay caller-owned (e.g. dashboard form).
 */
export function bentleySnapshotToCampaignLaunchPrefillBridge(snap: BentleySnapshot): {
  launchPrefill: BentleyLaunchPrefill | undefined;
  campaignGenerated: boolean;
} {
  return {
    launchPrefill: snap.launchPrefill,
    campaignGenerated: snap.pipeline?.campaignGenerated === true,
  };
}

/** Platform rows for API instructions / OAuth scoping in CampaignLaunchSection (subset of SocialPlatform). */
export const CAMPAIGN_LAUNCH_SECTION_PLATFORM_ROWS = [
  { key: "linkedin" as const, label: "LinkedIn" },
  { key: "instagram" as const, label: "Instagram" },
  { key: "facebook" as const, label: "Facebook" },
  { key: "tiktok" as const, label: "TikTok" },
  { key: "pinterest" as const, label: "Pinterest" },
  { key: "snapchat" as const, label: "Snapchat" },
] as const;

export type CampaignLaunchPlatformRow = (typeof CAMPAIGN_LAUNCH_SECTION_PLATFORM_ROWS)[number];

/**
 * When `postingTargets` is set, only those platforms appear in connect / API-instruction UI.
 * When empty/undefined, all known launch platforms are shown.
 */
export function filterCampaignLaunchPlatformsByTargets(
  postingTargets?: SocialPlatform[]
): CampaignLaunchPlatformRow[] {
  if (!postingTargets?.length) return [...CAMPAIGN_LAUNCH_SECTION_PLATFORM_ROWS];
  const set = new Set(postingTargets);
  return CAMPAIGN_LAUNCH_SECTION_PLATFORM_ROWS.filter((p) => set.has(p.key));
}

/** Mirrors CampaignLaunchSection prefill for new-campaign name (must stay in sync with the component effect). */
export function nextNewCampaignNameAfterLaunchPrefill(
  campaignGenerated: boolean,
  launchPrefill: BentleyLaunchPrefill | undefined,
  prevNewCampaignName: string
): string {
  if (!campaignGenerated || !launchPrefill) return prevNewCampaignName;
  if (!launchPrefill.campaignName?.trim()) return prevNewCampaignName;
  return prevNewCampaignName.trim() || launchPrefill.campaignName.trim();
}

/** Mirrors CampaignLaunchSection prefill for image description (must stay in sync with the component effect). */
export function nextDescriptionAfterLaunchPrefill(
  campaignGenerated: boolean,
  launchPrefill: BentleyLaunchPrefill | undefined,
  prevDescription: string
): string {
  if (!campaignGenerated || !launchPrefill) return prevDescription;
  if (prevDescription.trim()) return prevDescription;
  const cap = launchPrefill.caption?.trim();
  const hooks = launchPrefill.hooks?.trim();
  const cta = launchPrefill.cta?.trim();
  if (!cap && !hooks && !cta) return prevDescription;
  return [cap, hooks, cta].filter(Boolean).join("\n\n");
}
