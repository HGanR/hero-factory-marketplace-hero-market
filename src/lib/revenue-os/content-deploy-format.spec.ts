import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import {
  buildContentDeployPayload,
  formatDeployPlainText,
  inferDeployPreset,
  splitHookCaptionCta,
} from "./content-deploy-format";

const sample: ContentEngineOutput = {
  captions: {
    hook: "Hook line",
    authority: "a",
    curiosity: "curiosity CTA",
    controversial: "c",
    shortViral: "sv",
  },
  imagePrompts: [],
  viralIdeas: [],
  hooks: ["Alt hook"],
  fullPost: {
    caption: "First line caption\nrest",
    content: "Body\n\nCTA line",
    visualPrompt: "v",
    hashtags: ["#a"],
  },
};

describe("content-deploy-format", () => {
  it("inferDeployPreset maps labels", () => {
    expect(inferDeployPreset("TikTok")).toBe("tiktok");
    expect(inferDeployPreset("Instagram Reels")).toBe("instagram");
    expect(inferDeployPreset("YouTube Shorts")).toBe("youtube");
  });

  it("splitHookCaptionCta prefers captions.hook", () => {
    const s = splitHookCaptionCta(sample);
    expect(s.hook).toBe("Hook line");
    expect(s.caption).toContain("First line");
  });

  it("formatDeployPlainText includes preset header", () => {
    const t = formatDeployPlainText("tiktok", sample, "Acme");
    expect(t).toContain("[TikTok");
    expect(t).toContain("Acme");
  });

  it("buildContentDeployPayload is JSON-serializable", () => {
    const p = buildContentDeployPayload(sample, "Instagram");
    expect(p.preset).toBe("instagram");
    expect(JSON.stringify(p)).toContain("Hook line");
  });
});
