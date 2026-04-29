import { deriveSocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";

describe("deriveSocialAccountCapabilityFlags", () => {
  it("marks tiktok as not direct-in-app when adapter is absent", () => {
    const r = deriveSocialAccountCapabilityFlags("tiktok", null);
    expect(r.directOrganicPublishAvailable).toBe(false);
    expect(r.flags.canPublishText).toBe(false);
  });

  it("allows linkedin text publish when adapter exists", () => {
    const r = deriveSocialAccountCapabilityFlags("linkedin", null);
    expect(r.directOrganicPublishAvailable).toBe(true);
    expect(r.flags.canPublishText).toBe(true);
  });
});
