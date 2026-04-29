import { isFromSocialStudioUtm } from "@/lib/social/social-post-from-social-studio-utm";

describe("isFromSocialStudioUtm", () => {
  it("true for from_social_studio, social_studio_source, or run id", () => {
    expect(isFromSocialStudioUtm({ from_social_studio: "1" })).toBe(true);
    expect(isFromSocialStudioUtm({ social_studio_source: "1" })).toBe(true);
    expect(isFromSocialStudioUtm({ social_studio_run_id: "abc" })).toBe(true);
    expect(isFromSocialStudioUtm({})).toBe(false);
  });
});
