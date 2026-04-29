/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  readCanonicalBentleySnapshot,
  writeCanonicalBentleySnapshot,
} from "@/lib/revenue-os/bentley-canonical-snapshot";
import {
  bentleySnapshotToCampaignLaunchPrefillBridge,
  filterCampaignLaunchPlatformsByTargets,
  nextNewCampaignNameAfterLaunchPrefill,
} from "@/lib/revenue-os/bentley-launch-prefill";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { SocialPlatform } from "@/lib/social/config";

function baseSnapshot(): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1000,
    conversionRate: 1,
    aov: 100,
    businessName: "Acme",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: ["LinkedIn", "TikTok"],
    postingPlatforms: ["linkedin", "instagram"],
    tone: "Pro",
    contentType: "Post",
    imageStyle: "clean",
    campaignNotes: "",
  };
}

describe("canonical Bentley snapshot → campaign launch prefill bridge", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("round-trips pipeline + launchPrefill through write/read and maps the bridge for prefill", () => {
    const launchPrefill = {
      campaignName: "Acme — launch",
      caption: "Main caption",
      hooks: "Hook A\nHook B",
      cta: "Book a call",
      platformsLabel: "LinkedIn, TikTok",
    };

    const snap: BentleySnapshot = {
      ...baseSnapshot(),
      pipeline: {
        intakeComplete: true,
        analysisComplete: true,
        contentGenerated: true,
        campaignGenerated: true,
        launchReady: false,
      },
      launchPrefill,
      postingPlatforms: ["linkedin"],
      platforms: ["LinkedIn"],
    };

    writeCanonicalBentleySnapshot(snap);
    const read = readCanonicalBentleySnapshot();
    expect(read).not.toBeNull();

    expect(read!.launchPrefill).toEqual(launchPrefill);
    expect(read!.pipeline?.campaignGenerated).toBe(true);

    const bridge = bentleySnapshotToCampaignLaunchPrefillBridge(read!);
    expect(bridge.launchPrefill).toEqual(launchPrefill);
    expect(bridge.campaignGenerated).toBe(true);

    const formPostingTargets: SocialPlatform[] = ["tiktok"];
    expect(formPostingTargets).not.toEqual(read!.postingPlatforms);
    expect(filterCampaignLaunchPlatformsByTargets(formPostingTargets).map((r) => r.key)).toEqual(["tiktok"]);
  });

  it("does not enable prefill behavior when campaignGenerated is false even if launchPrefill is present", () => {
    const launchPrefill = {
      campaignName: "Should not apply",
      caption: "X",
      hooks: "Y",
      cta: "Z",
      platformsLabel: "P",
    };

    const snap: BentleySnapshot = {
      ...baseSnapshot(),
      pipeline: {
        intakeComplete: true,
        analysisComplete: true,
        contentGenerated: true,
        campaignGenerated: false,
        launchReady: false,
      },
      launchPrefill,
    };

    writeCanonicalBentleySnapshot(snap);
    const read = readCanonicalBentleySnapshot();
    expect(read).not.toBeNull();
    expect(read!.pipeline?.campaignGenerated).toBe(false);
    expect(read!.launchPrefill).toEqual(launchPrefill);

    const bridge = bentleySnapshotToCampaignLaunchPrefillBridge(read!);
    expect(bridge.campaignGenerated).toBe(false);
    expect(bridge.launchPrefill).toEqual(launchPrefill);

    expect(nextNewCampaignNameAfterLaunchPrefill(false, bridge.launchPrefill, "")).toBe("");
  });
});
