import { filterSocialStudioAccountsForTarget, labelSocialStudioAccountOption } from "@/lib/revenue-os/social-studio-account-labels";

describe("social-studio-account-labels", () => {
  const a = (over: Record<string, unknown> = {}) => ({
    id: "id-1",
    platform: "linkedin",
    displayName: "Pat",
    directOrganicPublishAvailable: true,
    status: "connected" as const,
    ...over,
  });

  it("labels a matching connected account for schedule/publish", () => {
    const s = labelSocialStudioAccountOption(a(), "linkedin");
    expect(s).toContain("publish/schedule");
  });

  it("flags wrong-network accounts", () => {
    const s = labelSocialStudioAccountOption(a(), "instagram");
    expect(s.toLowerCase()).toContain("wrong network");
  });

  it("filters by target platform", () => {
    const list = [a(), a({ id: "2", platform: "instagram" })];
    const f = filterSocialStudioAccountsForTarget(list, "linkedin");
    expect(f).toHaveLength(1);
  });
});
