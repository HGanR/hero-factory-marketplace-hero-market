import {
  buildBaselineCampaignNotesFromIntake,
  BENTLEY_CAMPAIGN_NOTES_MIN,
} from "@/lib/revenue-os/bentley-auto-campaign-notes";
import {
  getWorkflowPhase,
  structuredGuidedIntakeCompleteForCampaign,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import type { SocialPlatform } from "@/lib/social/config";

function fullStructuredSnapshot(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "saas",
    contentIndustry: "",
    targetAudience: "SMB owners",
    traffic: 1000,
    conversionRate: 2,
    aov: 500,
    businessName: "Acme Co",
    coreOffer: "Done-for-you onboarding",
    transformation: "Cut churn in 90 days",
    platforms: ["LinkedIn"],
    postingPlatforms: ["linkedin"] as SocialPlatform[],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "",
    optionalAck: { traffic: true, conversion: true, aov: true, tone: true, contentType: true, imageStyle: true },
    ...over,
  };
}

describe("buildBaselineCampaignNotesFromIntake", () => {
  it("produces at least BENTLEY_CAMPAIGN_NOTES_MIN characters", () => {
    const text = buildBaselineCampaignNotesFromIntake(fullStructuredSnapshot());
    expect(text.length).toBeGreaterThanOrEqual(BENTLEY_CAMPAIGN_NOTES_MIN);
    expect(text).toContain("Acme Co");
    expect(text).toContain("SMB owners");
  });

  it("tolerates numeric snapshot string fields from corrupt session JSON", () => {
    const text = buildBaselineCampaignNotesFromIntake(
      fullStructuredSnapshot({
        businessName: 404 as unknown as string,
        coreOffer: 505 as unknown as string,
        contentIndustry: 606 as unknown as string,
        industryKey: null,
      }),
    );
    expect(text).toContain("404");
    expect(text).toContain("505");
    expect(text).toContain("606");
  });
});

describe("structuredGuidedIntakeCompleteForCampaign + workflow phase", () => {
  it("marks campaign notes satisfied without manual notes when structured intake is complete", () => {
    const s = fullStructuredSnapshot({ campaignNotes: "" });
    expect(structuredGuidedIntakeCompleteForCampaign(s)).toBe(true);
    expect(getWorkflowPhase(s)).toBe("ready");
  });

  it("does not reach ready when structured intake is incomplete", () => {
    const s = fullStructuredSnapshot({ businessName: "", campaignNotes: "" });
    expect(structuredGuidedIntakeCompleteForCampaign(s)).toBe(false);
    expect(getWorkflowPhase(s)).not.toBe("ready");
  });
});
