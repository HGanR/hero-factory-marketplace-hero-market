import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { RevenueOsLaunchSharedProfile } from "@/lib/revenue-os/launch-mode-types";
import {
  buildBentleyMarketingProfile,
  mergeBentleyMarketingProfile,
  summarizeBentleyMarketingProfileCompleteness,
} from "@/lib/revenue-os/bentley-marketing-profile";

const baseSnap = (over: Partial<BentleySnapshot> = {}): BentleySnapshot => ({
  industryKey: "consulting",
  contentIndustry: "",
  targetAudience: "Founders",
  traffic: 0,
  conversionRate: 0,
  aov: 0,
  businessName: "Acme",
  coreOffer: "Offer A",
  transformation: "Outcome B",
  platforms: [],
  tone: "Professional",
  contentType: "Full Post",
  imageStyle: "cinematic",
  campaignNotes: "Some notes here for the campaign section.",
  postingPlatforms: ["instagram", "linkedin"],
  ...over,
});

const baseShared: RevenueOsLaunchSharedProfile = {
  businessName: "",
  coreOffer: "Session offer",
  transformation: "Better pipeline",
  targetAudience: "Agencies",
  industry: "Marketing",
  postingPlatforms: ["Instagram", "LinkedIn"],
};

describe("bentley-marketing-profile", () => {
  it("build merges snapshot priority over empty shared strings", () => {
    const p = buildBentleyMarketingProfile({
      bentleySnapshot: baseSnap(),
      sharedProfile: baseShared,
      authenticatedPostingPlatforms: ["instagram"],
    });
    expect(p.businessName).toBe("Acme");
    expect(p.coreOffer).toBe("Offer A");
    expect(p.postingPlatforms.length).toBeGreaterThan(0);
  });

  it("mergeBentleyMarketingProfile combines platforms and prefers non-empty second", () => {
    const a = buildBentleyMarketingProfile({
      bentleySnapshot: baseSnap({ businessName: "A", postingPlatforms: ["instagram"] }),
      sharedProfile: baseShared,
    });
    const b = buildBentleyMarketingProfile({
      bentleySnapshot: baseSnap({
        businessName: "",
        coreOffer: "",
        transformation: "",
        targetAudience: "",
        campaignNotes: "",
        postingPlatforms: ["tiktok"],
      }),
      sharedProfile: {
        ...baseShared,
        businessName: "MergedCo",
        coreOffer: "New offer",
      },
    });
    const m = mergeBentleyMarketingProfile(a, b);
    expect(m.businessName).toBe("MergedCo");
    expect(m.postingPlatforms.join(",")).toContain("instagram");
    expect(m.postingPlatforms.join(",")).toContain("tiktok");
  });

  it("summarizeBentleyMarketingProfileCompleteness reflects mixed session/auth merge", () => {
    const p = mergeBentleyMarketingProfile(
      buildBentleyMarketingProfile({
        bentleySnapshot: baseSnap({ campaignNotes: "" }),
        sharedProfile: baseShared,
      }),
      buildBentleyMarketingProfile({
        bentleySnapshot: baseSnap({
          businessName: "",
          coreOffer: "",
          transformation: "",
          targetAudience: "",
          industryKey: null,
          contentIndustry: "",
          campaignNotes: "",
          postingPlatforms: [],
        }),
        sharedProfile: baseShared,
        authenticatedPostingPlatforms: ["instagram", "linkedin"],
      })
    );
    const c = summarizeBentleyMarketingProfileCompleteness(p);
    expect(c.score).toBeGreaterThanOrEqual(5);
    expect(c.strengths.length).toBeGreaterThan(0);
  });
});
