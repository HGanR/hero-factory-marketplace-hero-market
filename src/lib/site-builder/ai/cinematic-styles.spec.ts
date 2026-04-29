import { describe, expect, it } from "@jest/globals";
import {
  CINEMATIC_STYLE_BY_LAYOUT_FAMILY,
  applyLayoutFamilyTokensToPlannerDesignTokens,
  buildBrandGradientPair,
  getCinematicStylePresetForLayoutFamily,
  mapPresetBackgroundToPlannerMode,
} from "@/lib/site-builder/ai/cinematic-styles";
import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";

describe("cinematic-styles v2", () => {
  it("assigns a distinct preset per layout family id", () => {
    const ids = Object.keys(CINEMATIC_STYLE_BY_LAYOUT_FAMILY);
    expect(ids.length).toBe(8);
    const sigs = ids.map((id) => {
      const p = CINEMATIC_STYLE_BY_LAYOUT_FAMILY[id as keyof typeof CINEMATIC_STYLE_BY_LAYOUT_FAMILY];
      return `${p.gradientStyle}|${p.backgroundStyle}|${p.lightingStyle}|${p.motionHint}|${p.sectionSpacing}|${p.typographyTone}`;
    });
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("returns preset for known layout family", () => {
    const p = getCinematicStylePresetForLayoutFamily("web3_immersive");
    expect(p?.gradientStyle).toBe("neon");
    expect(p?.lightingStyle).toBe("neon-glow");
  });

  it("buildBrandGradientPair avoids ultra-light pairs", () => {
    const { start, end } = buildBrandGradientPair("#f8fafc", "salt-a");
    expect(start.startsWith("#")).toBe(true);
    expect(end.startsWith("#")).toBe(true);
    expect(start).not.toBe(end);
  });

  it("applyLayoutFamilyTokensToPlannerDesignTokens mutates design tokens", () => {
    const dt: SitePlannerOutput["designTokens"] = {
      accent: "#22c55e",
      gradientStart: "#000000",
      gradientEnd: "#111111",
    };
    applyLayoutFamilyTokensToPlannerDesignTokens(dt, "product_showcase", "seed");
    expect(dt.gradientStyle).toBeTruthy();
    expect(dt.backgroundMode).toBeTruthy();
    expect(dt.motionHint).toBeTruthy();
    expect(typeof dt.motionIntensity).toBe("number");
    expect(mapPresetBackgroundToPlannerMode("gradient", "soft")).toBeTruthy();
  });
});
