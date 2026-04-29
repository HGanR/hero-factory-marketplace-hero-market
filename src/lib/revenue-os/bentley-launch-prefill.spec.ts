import { describe, it, expect } from "@jest/globals";
import { buildLaunchPrefillFromArtifacts } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import {
  filterCampaignLaunchPlatformsByTargets,
  nextDescriptionAfterLaunchPrefill,
  nextNewCampaignNameAfterLaunchPrefill,
} from "@/lib/revenue-os/bentley-launch-prefill";

function minimalSnapshot(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1000,
    conversionRate: 1,
    aov: 100,
    businessName: "Acme Co",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: ["LinkedIn"],
    postingPlatforms: ["linkedin"],
    tone: "Pro",
    contentType: "Post",
    imageStyle: "clean",
    campaignNotes: "",
    ...over,
  };
}

describe("bentley-launch-prefill", () => {
  const prefill = {
    campaignName: "Spring push",
    caption: "Cap",
    hooks: "Hook line",
    cta: "Book now",
  };

  it("prefills campaign name and description when campaignGenerated and fields were empty", () => {
    expect(
      nextNewCampaignNameAfterLaunchPrefill(true, prefill, "")
    ).toBe("Spring push");
    expect(nextDescriptionAfterLaunchPrefill(true, prefill, "")).toBe(
      "Cap\n\nHook line\n\nBook now"
    );
  });

  it("does not overwrite existing campaign name", () => {
    expect(
      nextNewCampaignNameAfterLaunchPrefill(true, prefill, "User campaign")
    ).toBe("User campaign");
  });

  it("does not overwrite existing description", () => {
    expect(
      nextDescriptionAfterLaunchPrefill(true, prefill, "User wrote this")
    ).toBe("User wrote this");
  });

  it("does not apply prefill when campaignGenerated is false", () => {
    expect(nextNewCampaignNameAfterLaunchPrefill(false, prefill, "")).toBe("");
    expect(nextDescriptionAfterLaunchPrefill(false, prefill, "")).toBe("");
  });

  it("does not apply prefill when launchPrefill is missing", () => {
    expect(nextNewCampaignNameAfterLaunchPrefill(true, undefined, "")).toBe("");
    expect(nextDescriptionAfterLaunchPrefill(true, undefined, "")).toBe("");
  });

  it("leaves name unchanged when prefill has no campaignName", () => {
    expect(
      nextNewCampaignNameAfterLaunchPrefill(true, { caption: "x" }, "")
    ).toBe("");
  });

  it("filterCampaignLaunchPlatformsByTargets shows all platforms when postingTargets unset", () => {
    const all = filterCampaignLaunchPlatformsByTargets(undefined);
    expect(all.map((p) => p.key)).toEqual([
      "linkedin",
      "instagram",
      "facebook",
      "tiktok",
      "pinterest",
      "snapchat",
    ]);
  });

  it("filterCampaignLaunchPlatformsByTargets restricts connect/API rows to postingTargets only", () => {
    const filtered = filterCampaignLaunchPlatformsByTargets(["tiktok", "linkedin"]);
    expect(filtered.map((p) => p.key)).toEqual(["linkedin", "tiktok"]);
  });
});

describe("buildLaunchPrefillFromArtifacts (canonical campaign → launch fields)", () => {
  it("maps snapshot + campaign + content engine into launch prefill fields", () => {
    const snap = minimalSnapshot({ businessName: "Globex" });
    const campaign = {
      offerStatement: "Offer line",
      shortFormHooks: ["H1", "H2"],
      longFormOutlines: [{ cta: "Shop" }],
    } as unknown as CampaignResponse;
    const content: ContentEngineOutput = {
      fullPost: { caption: "Engine caption" },
    } as ContentEngineOutput;

    const prefill = buildLaunchPrefillFromArtifacts(snap, campaign, content);
    expect(prefill.campaignName).toContain("Globex");
    expect(prefill.caption).toBe("Engine caption");
    expect(prefill.hooks).toContain("H1");
    expect(prefill.cta).toBeTruthy();
    expect(prefill.platformsLabel).toContain("LinkedIn");
  });
});
