import { describe, it, expect } from "@jest/globals";
import {
  GOVERNED_SOCIAL_PUBLISH_PLATFORMS,
  defaultSocialAccountLabelForPlatform,
  isGovernedSocialPublishPlatform,
} from "@/lib/social/social-governed-platforms";

describe("social-governed-platforms", () => {
  it("lists linkedin, facebook, instagram", () => {
    expect(GOVERNED_SOCIAL_PUBLISH_PLATFORMS).toEqual(["linkedin", "facebook", "instagram"]);
  });

  it("isGovernedSocialPublishPlatform accepts governed keys only", () => {
    expect(isGovernedSocialPublishPlatform("linkedin")).toBe(true);
    expect(isGovernedSocialPublishPlatform("facebook")).toBe(true);
    expect(isGovernedSocialPublishPlatform("instagram")).toBe(true);
    expect(isGovernedSocialPublishPlatform("tiktok")).toBe(false);
    expect(isGovernedSocialPublishPlatform("")).toBe(false);
  });

  it("defaultSocialAccountLabelForPlatform maps display names", () => {
    expect(defaultSocialAccountLabelForPlatform("linkedin")).toBe("LinkedIn");
    expect(defaultSocialAccountLabelForPlatform("facebook")).toBe("Facebook");
    expect(defaultSocialAccountLabelForPlatform("instagram")).toBe("Instagram");
    expect(defaultSocialAccountLabelForPlatform("unknown")).toBe("unknown");
  });
});
