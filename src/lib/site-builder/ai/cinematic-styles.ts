import type { z } from "zod";
import type { LayoutFamily } from "@/lib/site-builder/ai/layout-families";
import {
  BackgroundModeSchema,
  GradientStyleSchema,
  MotionHintSchema,
  type SitePlannerOutput,
} from "@/lib/site-builder/ai/schemas";

type BackgroundMode = z.infer<typeof BackgroundModeSchema>;
type GradientStyle = z.infer<typeof GradientStyleSchema>;
type MotionHint = z.infer<typeof MotionHintSchema>;

export type LayoutFamilyId = LayoutFamily["id"];

export type CinematicGradientStylePreset = "mesh" | "radial" | "linear" | "neon" | "glass";

export type CinematicBackgroundStylePreset = "solid" | "gradient" | "image-overlay" | "3d-depth";

export type CinematicLightingStylePreset = "soft" | "high-contrast" | "neon-glow" | "ambient";

export type CinematicMotionHintPreset = "subtle" | "scroll-reactive" | "parallax" | "none";

export type CinematicSectionSpacingPreset = "tight" | "balanced" | "spacious";

export type CinematicTypographyTonePreset = "minimal" | "editorial" | "bold" | "futuristic";

export type CinematicStylePresetV2 = {
  gradientStyle: CinematicGradientStylePreset;
  backgroundStyle: CinematicBackgroundStylePreset;
  lightingStyle: CinematicLightingStylePreset;
  motionHint: CinematicMotionHintPreset;
  sectionSpacing: CinematicSectionSpacingPreset;
  typographyTone: CinematicTypographyTonePreset;
};

export const CINEMATIC_STYLE_BY_LAYOUT_FAMILY: Record<LayoutFamilyId, CinematicStylePresetV2> = {
  cinematic_hero_journey: {
    gradientStyle: "mesh",
    backgroundStyle: "gradient",
    lightingStyle: "ambient",
    motionHint: "parallax",
    sectionSpacing: "spacious",
    typographyTone: "editorial",
  },
  split_authority: {
    gradientStyle: "glass",
    backgroundStyle: "image-overlay",
    lightingStyle: "high-contrast",
    motionHint: "subtle",
    sectionSpacing: "balanced",
    typographyTone: "bold",
  },
  conversion_funnel: {
    gradientStyle: "radial",
    backgroundStyle: "gradient",
    lightingStyle: "high-contrast",
    motionHint: "scroll-reactive",
    sectionSpacing: "tight",
    typographyTone: "bold",
  },
  editorial_story: {
    gradientStyle: "linear",
    backgroundStyle: "solid",
    lightingStyle: "soft",
    motionHint: "subtle",
    sectionSpacing: "spacious",
    typographyTone: "editorial",
  },
  product_showcase: {
    gradientStyle: "neon",
    backgroundStyle: "3d-depth",
    lightingStyle: "neon-glow",
    motionHint: "parallax",
    sectionSpacing: "balanced",
    typographyTone: "futuristic",
  },
  local_service: {
    gradientStyle: "linear",
    backgroundStyle: "gradient",
    lightingStyle: "soft",
    motionHint: "scroll-reactive",
    sectionSpacing: "balanced",
    typographyTone: "minimal",
  },
  premium_minimal: {
    gradientStyle: "glass",
    backgroundStyle: "solid",
    lightingStyle: "ambient",
    motionHint: "none",
    sectionSpacing: "spacious",
    typographyTone: "minimal",
  },
  web3_immersive: {
    gradientStyle: "neon",
    backgroundStyle: "gradient",
    lightingStyle: "neon-glow",
    motionHint: "parallax",
    sectionSpacing: "balanced",
    typographyTone: "futuristic",
  },
};

export function getCinematicStylePresetForLayoutFamily(id: string | undefined): CinematicStylePresetV2 | null {
  if (!id?.trim()) return null;
  const k = id.trim() as LayoutFamilyId;
  return CINEMATIC_STYLE_BY_LAYOUT_FAMILY[k] ?? null;
}

export function mapPresetGradientToPlannerStyle(g: CinematicGradientStylePreset): GradientStyle {
  const m: Record<CinematicGradientStylePreset, GradientStyle> = {
    mesh: "soft-mesh",
    radial: "neon-radial",
    linear: "soft-mesh",
    neon: "neon-radial",
    glass: "chrome",
  };
  return m[g];
}

export function mapPresetMotionToPlannerHint(h: CinematicMotionHintPreset): MotionHint {
  const m: Record<CinematicMotionHintPreset, MotionHint> = {
    subtle: "subtle-parallax",
    "scroll-reactive": "scroll-reveal",
    parallax: "subtle-parallax",
    none: "none",
  };
  return m[h];
}

export function mapPresetBackgroundToPlannerMode(
  bg: CinematicBackgroundStylePreset,
  lighting: CinematicLightingStylePreset,
): BackgroundMode {
  if (bg === "3d-depth") return lighting === "soft" ? "luxury-minimal" : "holographic-gradient";
  if (bg === "image-overlay") return "abstract_gradients";
  if (bg === "gradient") {
    return lighting === "neon-glow" || lighting === "high-contrast" ? "holographic-gradient" : "abstract_gradients";
  }
  return lighting === "soft" ? "white-editorial" : "simple_gradients";
}

export function typographyToneToMotionIntensity(tone: CinematicTypographyTonePreset): number {
  const m: Record<CinematicTypographyTonePreset, number> = {
    minimal: 28,
    editorial: 46,
    bold: 74,
    futuristic: 86,
  };
  return m[tone];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{6}|[0-9a-f]{3})$/i.test(h)) return null;
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  const x = (v: number) => v.toString(16).padStart(2, "0");
  return `#${x(Math.round(r))}${x(Math.round(g))}${x(Math.round(b))}`;
}

function mix(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

/** Ensure two hex stops are not both extremely light (readability heuristic for hero shells). */
export function buildBrandGradientPair(accentHex: string | undefined, salt: string): { start: string; end: string } {
  const base = parseHex(accentHex || "#6366f1") ?? { r: 99, g: 102, b: 241 };
  const h = salt.length % 5;
  const ink = { r: 15, g: 23, b: 42 };
  const mist = { r: 248, g: 250, b: 252 };
  let start = mix(base, ink, 0.35 + h * 0.06);
  let end = mix(base, mist, 0.22 + h * 0.05);

  if (relativeLuminance(start) > 0.72 && relativeLuminance(end) > 0.78) {
    end = mix(parseHex(end) ?? end, ink, 0.55);
  }
  if (relativeLuminance(start) < 0.04 && relativeLuminance(end) < 0.06) {
    start = mix(start, mist, 0.35);
  }

  return { start: toHex(start.r, start.g, start.b), end: toHex(end.r, end.g, end.b) };
}

export function mapLightingToDepthAndButton(lighting: CinematicLightingStylePreset): {
  depthStyle: "flat" | "card-depth" | "cinematic-layered" | "floating-panels";
  buttonStyle: "glow" | "glass" | "bold-solid" | "chrome" | "minimal";
} {
  switch (lighting) {
    case "neon-glow":
      return { depthStyle: "floating-panels", buttonStyle: "glow" };
    case "high-contrast":
      return { depthStyle: "cinematic-layered", buttonStyle: "bold-solid" };
    case "ambient":
      return { depthStyle: "card-depth", buttonStyle: "chrome" };
    case "soft":
    default:
      return { depthStyle: "card-depth", buttonStyle: "glass" };
  }
}

/**
 * Mutates planner `designTokens` with layout-family cinematic defaults (Variant Engine v2 stays upstream).
 */
export function applyLayoutFamilyTokensToPlannerDesignTokens(
  dt: SitePlannerOutput["designTokens"],
  layoutFamilyId: string,
  salt: string,
): void {
  const preset = getCinematicStylePresetForLayoutFamily(layoutFamilyId);
  if (!preset) return;
  const pair = buildBrandGradientPair(dt.accent, salt);
  dt.gradientStart = pair.start;
  dt.gradientEnd = pair.end;
  dt.gradientStyle = mapPresetGradientToPlannerStyle(preset.gradientStyle);
  dt.backgroundMode = mapPresetBackgroundToPlannerMode(preset.backgroundStyle, preset.lightingStyle);
  dt.motionHint = mapPresetMotionToPlannerHint(preset.motionHint);
  dt.motionIntensity = typographyToneToMotionIntensity(preset.typographyTone);
  const lb = mapLightingToDepthAndButton(preset.lightingStyle);
  dt.depthStyle = lb.depthStyle;
  dt.buttonStyle = lb.buttonStyle;
}
