import { buildShortFormPlatformPack } from "./platformShortForm";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

const sample: ContentEngineOutput = {
  captions: {
    hook: "Hook line",
    authority: "a",
    curiosity: "c",
    controversial: "x",
    shortViral: "sv",
  },
  imagePrompts: ["", "", ""],
  viralIdeas: [],
  hooks: ["alt hook"],
  fullPost: {
    caption: "Caption body",
    content: "Para1\n\nBook a call today.",
    visualPrompt: "v",
    hashtags: ["#test"],
  },
};

describe("buildShortFormPlatformPack", () => {
  it("returns three platform slices with hooks and CTAs", () => {
    const pack = buildShortFormPlatformPack(sample, "Acme");
    expect(pack.tiktok.label).toBe("TikTok");
    expect(pack.instagram_reels.cta.toLowerCase()).toContain("dm");
    expect(pack.youtube_shorts.cta.toLowerCase()).toContain("subscribe");
    expect(pack.tiktok.hashtags.length).toBeGreaterThan(0);
  });
});
