import { describe, it, expect } from "@jest/globals";
import { createSocialProvider } from "@/lib/social/providers";

describe("createSocialProvider", () => {
  it("returns providers for linkedin, facebook, instagram", () => {
    expect(createSocialProvider("linkedin")?.key).toBe("linkedin");
    expect(createSocialProvider("facebook")?.key).toBe("facebook");
    expect(createSocialProvider("instagram")?.key).toBe("instagram");
  });

  it("returns null for keys outside the governed set (runtime)", () => {
    expect(createSocialProvider("tiktok" as unknown as import("./types").SocialProviderKey)).toBeNull();
  });
});
