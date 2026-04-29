import { describe, it, expect } from "@jest/globals";
import {
  buildBentleyUnitKey,
  buildCaptionForSlot,
  collectBentleyUnitKeysFromPosts,
  computeScheduledAt,
  resolveOauthPlatformsForBentleyLaunch,
  BENTLEY_UTM_UNIT_KEY,
} from "@/lib/revenue-os/bentley-sync-launch-plan";

describe("bentley-sync-launch-plan", () => {
  it("buildBentleyUnitKey is stable across calls", () => {
    expect(buildBentleyUnitKey("c1", "instagram", 0)).toBe(buildBentleyUnitKey("c1", "instagram", 0));
    expect(buildBentleyUnitKey("c1", "instagram", 0)).not.toBe(buildBentleyUnitKey("c1", "linkedin", 0));
  });

  it("resolveOauthPlatformsForBentleyLaunch prefers posting platforms", () => {
    expect(
      resolveOauthPlatformsForBentleyLaunch({
        postingPlatforms: ["linkedin", "instagram"],
        contentPlatforms: ["TikTok"],
      })
    ).toEqual(["linkedin", "instagram"]);
  });

  it("resolveOauthPlatformsForBentleyLaunch maps content labels when posting empty", () => {
    const p = resolveOauthPlatformsForBentleyLaunch({
      postingPlatforms: [],
      contentPlatforms: ["Instagram", "LinkedIn"],
    });
    expect(p).toContain("instagram");
    expect(p).toContain("linkedin");
  });

  it("collectBentleyUnitKeysFromPosts reads utm", () => {
    const keys = collectBentleyUnitKeysFromPosts([
      { utmParams: { [BENTLEY_UTM_UNIT_KEY]: "abc" } },
      { utmParams: {} },
    ]);
    expect([...keys]).toEqual(["abc"]);
  });

  it("computeScheduledAt immediate uses same base offset", () => {
    const now = 1_700_000_000_000;
    const a = computeScheduledAt({
      strategy: "immediate",
      slotIndex: 0,
      totalSlots: 3,
      staggerMinutes: 30,
      nowMs: now,
      leadMs: 60_000,
    });
    const b = computeScheduledAt({
      strategy: "immediate",
      slotIndex: 2,
      totalSlots: 3,
      staggerMinutes: 30,
      nowMs: now,
      leadMs: 60_000,
    });
    expect(a.getTime()).toBe(b.getTime());
  });

  it("computeScheduledAt staggered increases by slot", () => {
    const now = 1_700_000_000_000;
    const a = computeScheduledAt({
      strategy: "staggered",
      slotIndex: 0,
      totalSlots: 2,
      staggerMinutes: 30,
      nowMs: now,
      leadMs: 60_000,
    });
    const b = computeScheduledAt({
      strategy: "staggered",
      slotIndex: 1,
      totalSlots: 2,
      staggerMinutes: 30,
      nowMs: now,
      leadMs: 60_000,
    });
    expect(b.getTime() - a.getTime()).toBe(30 * 60_000);
  });

  it("buildCaptionForSlot merges hook and offer", () => {
    const c = buildCaptionForSlot(
      {
        industry: "x",
        targetAudience: "y",
        generatedAt: new Date().toISOString(),
        offerStatement: "Core offer",
        messagePillars: [],
        shortFormHooks: ["Hook one"],
        longFormOutlines: [],
        objectionReplies: [],
        disclaimers: [],
      },
      0
    );
    expect(c).toContain("Hook one");
    expect(c).toContain("Core offer");
  });
});
