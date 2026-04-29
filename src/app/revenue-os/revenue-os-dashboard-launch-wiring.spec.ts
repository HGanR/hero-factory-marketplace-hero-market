import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";

describe("Revenue OS dashboard launch wiring", () => {
  it("renders CampaignLaunchSectionFromBentleySnapshot with form posting targets", () => {
    const pagePath = join(__dirname, "dashboard", "page.tsx");
    const src = readFileSync(pagePath, "utf8");
    expect(src).toContain("CampaignLaunchSectionFromBentleySnapshot");
    expect(src).toContain("postingTargets={form.postingPlatforms}");
    expect(src).not.toMatch(/<CampaignLaunchSection\s/);
  });
});
