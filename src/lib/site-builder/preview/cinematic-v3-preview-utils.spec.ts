import {
  getCinematicImageOverlayPlaceholderUrl,
  parseCinematicMotionFromBlock,
  previewMotionIntensityFromTheme,
  shouldRunHeavyCinematicPreview,
} from "./cinematic-v3-preview-utils";

describe("parseCinematicMotionFromBlock", () => {
  it("maps parallax, fade, slide with clamped intensity", () => {
    expect(
      parseCinematicMotionFromBlock({
        content: { motion: { cinematic: { type: "parallax", intensity: 1.2 } } },
      }),
    ).toEqual({ type: "parallax", intensity: 1 });
    expect(
      parseCinematicMotionFromBlock({
        content: { motion: { cinematic: { type: "fade", intensity: -0.1 } } },
      }),
    ).toEqual({ type: "fade", intensity: 0 });
  });

  it("returns null when type is unknown or missing", () => {
    expect(parseCinematicMotionFromBlock({ content: { motion: { cinematic: { type: "zoom" } } } })).toBeNull();
    expect(parseCinematicMotionFromBlock({})).toBeNull();
  });
});

describe("shouldRunHeavyCinematicPreview", () => {
  it("disables on reduced motion, save data, or low memory", () => {
    expect(shouldRunHeavyCinematicPreview({ prefersReducedMotion: true, saveData: false, lowMemory: false })).toBe(false);
    expect(shouldRunHeavyCinematicPreview({ prefersReducedMotion: false, saveData: true, lowMemory: false })).toBe(false);
    expect(shouldRunHeavyCinematicPreview({ prefersReducedMotion: false, saveData: false, lowMemory: true })).toBe(false);
    expect(shouldRunHeavyCinematicPreview({ prefersReducedMotion: false, saveData: false, lowMemory: false })).toBe(true);
  });
});

describe("getCinematicImageOverlayPlaceholderUrl", () => {
  it("returns a stable Unsplash URL for a seed", () => {
    const a = getCinematicImageOverlayPlaceholderUrl("x", 800);
    const b = getCinematicImageOverlayPlaceholderUrl("x", 800);
    expect(a).toContain("https://images.unsplash.com/");
    expect(a).toBe(b);
  });
});

describe("previewMotionIntensityFromTheme", () => {
  it("uses explicit boost intensity", () => {
    expect(previewMotionIntensityFromTheme({ motionIntensity: 0.2 }, {})).toBe(0.2);
  });
});
