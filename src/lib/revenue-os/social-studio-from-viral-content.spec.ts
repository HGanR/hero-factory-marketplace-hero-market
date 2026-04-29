import {
  buildNativeImageSpecFromViralContent,
  buildPlatformCaptionVariantsFromViralContent,
  topicFromViralContent,
} from "@/lib/revenue-os/social-studio-from-viral-content";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

const sample: ContentEngineOutput = {
  captions: {
    hook: "Stop guessing your funnel",
    authority: "We tested 200 sequences",
    curiosity: "What we found",
    controversial: "Your stack is fine",
    shortViral: "POV: the fix was one line of copy",
  },
  imagePrompts: ["Neon city skyline at dusk, minimal text, editorial"],
  viralIdeas: [],
  hooks: ["The metric nobody tracks"],
  fullPost: {
    caption: "Funnel deep dive for operators",
    content: "Longer body for the post",
    visualPrompt: "Cinematic product hero with cyan accent, no small print",
    hashtags: ["#revenueos", "#growth"],
  },
};

describe("social-studio-from-viral-content", () => {
  it("picks topic from hook first", () => {
    expect(topicFromViralContent(sample, "fallback")).toBe("Stop guessing your funnel");
  });

  it("maps native image spec from visual prompt + hook", () => {
    const spec = buildNativeImageSpecFromViralContent(sample, { businessName: "Acme", topicFallback: "X" });
    expect(spec.title).toContain("Stop guessing");
    expect(spec.line3).toMatch(/Cinematic|Neon/);
  });

  it("injects viral into linkedin variant caption", () => {
    const v = buildPlatformCaptionVariantsFromViralContent({
      topic: "T",
      businessName: "Acme",
      contentEngine: sample,
    });
    const li = v.find((x) => x.platform === "linkedin");
    expect(li?.caption).toContain("Stop guessing");
    expect(li?.caption).toContain("We tested 200");
  });
});
