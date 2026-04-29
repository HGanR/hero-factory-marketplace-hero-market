/**
 * Maps persisted `metadata.theme` (incl. cinematic tokens) to a CSS `background` for the live preview shell.
 * Every cinematic token path should produce a visibly distinct treatment in the preview.
 */

/** Cinematic v2 + v3 preview shell controls (read from `metadata.visualMeta` + theme) */
export type PreviewVisualMetaBoost = {
  lightingStyle?: string;
  gradientStyle?: string;
  /** e.g. `image-overlay` — v3 can render a stock photo + gradient in preview */
  backgroundStyle?: string;
  /** 0–1, drives atmosphere, motion weight, and overlay strength */
  motionIntensity?: number;
  layoutFamilyId?: string;
  /** Merged from theme in provider */
  motionHint?: string;
} | null | undefined;

function withVisualMetaBoost(css: string, boost: PreviewVisualMetaBoost): string {
  if (!boost) return css;
  let out = css;
  if (boost.lightingStyle === "neon-glow") {
    out = `${out}, radial-gradient(circle at 72% 82%, rgba(236,72,153,0.18), transparent 46%)`;
  } else if (boost.lightingStyle === "ambient") {
    out = `${out}, radial-gradient(circle at 12% 88%, rgba(14,165,233,0.12), transparent 42%)`;
  } else if (boost.lightingStyle === "high-contrast") {
    out = `${out}, radial-gradient(circle at 50% 120%, rgba(15,23,42,0.35), transparent 52%)`;
  }
  if (boost.gradientStyle === "mesh" || boost.gradientStyle === "glass") {
    out = `${out}, radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 55%)`;
  }
  if (boost.gradientStyle === "neon" || boost.gradientStyle === "radial") {
    out = `${out}, radial-gradient(circle at 18% 18%, rgba(34,211,238,0.14), transparent 40%)`;
  }
  return out;
}

export function resolveSiteBuilderPreviewBackground(params: {
  backgroundMode: string;
  gradientStart: string;
  gradientEnd: string;
  customGradient: string;
  backgroundColor: string;
  gradientStyle?: string;
  visualMetaBoost?: PreviewVisualMetaBoost;
}): string {
  const { backgroundMode, gradientStart, gradientEnd, customGradient, backgroundColor, gradientStyle, visualMetaBoost } =
    params;

  if (backgroundMode === "custom_color") {
    return withVisualMetaBoost(backgroundColor, visualMetaBoost);
  }
  if (backgroundMode === "custom_media") {
    return withVisualMetaBoost(
      backgroundColor || `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`,
      visualMetaBoost,
    );
  }
  if (backgroundMode === "custom_gradient" && customGradient) {
    return withVisualMetaBoost(customGradient, visualMetaBoost);
  }
  if (backgroundMode === "white-editorial") {
    const mesh =
      gradientStyle === "chrome"
        ? "linear-gradient(135deg, #ffffff 0%, #e2e8f0 45%, #f8fafc 100%)"
        : "linear-gradient(180deg, #ffffff 0%, #f1f5f9 55%, #e2e8f0 100%)";
    return withVisualMetaBoost(`${mesh}, radial-gradient(circle at 80% 0%, rgba(15,23,42,0.06), transparent 42%)`, visualMetaBoost);
  }
  if (backgroundMode === "dark-cinematic") {
    return withVisualMetaBoost(
      "radial-gradient(ellipse 120% 80% at 50% -20%, #312e81, transparent 55%), radial-gradient(circle at 20% 90%, #0f766e, transparent 35%), linear-gradient(165deg, #020617, #0f172a 50%, #1e1b4b)",
      visualMetaBoost,
    );
  }
  if (backgroundMode === "holographic-gradient") {
    const g =
      gradientStyle === "neon-radial"
        ? `radial-gradient(circle at 20% 30%, rgba(34,211,238,0.35), transparent 40%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.4), transparent 38%), linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`
        : `radial-gradient(circle at 50% 0%, rgba(125,211,252,0.2), transparent 50%), linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`;
    return withVisualMetaBoost(g, visualMetaBoost);
  }
  if (backgroundMode === "glass-grid") {
    return withVisualMetaBoost(
      `linear-gradient(135deg, #f8fafc, #e2e8f0), repeating-linear-gradient(90deg, rgba(15,23,42,0.04) 0, rgba(15,23,42,0.04) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(0deg, rgba(15,23,42,0.04) 0, rgba(15,23,42,0.04) 1px, transparent 1px, transparent 32px)`,
      visualMetaBoost,
    );
  }
  if (backgroundMode === "luxury-minimal") {
    return withVisualMetaBoost(
      `linear-gradient(145deg, #fafaf9, #d6d3d1 55%, #a8a29e), radial-gradient(circle at 10% 10%, rgba(250,250,249,0.9), transparent 50%)`,
      visualMetaBoost,
    );
  }
  if (backgroundMode === "abstract_gradients") {
    return withVisualMetaBoost(
      "radial-gradient(circle at 10% 20%, #312e81, transparent 30%), radial-gradient(circle at 90% 10%, #7c2d12, transparent 35%), radial-gradient(circle at 60% 85%, #14532d, transparent 30%), #020617",
      visualMetaBoost,
    );
  }
  return withVisualMetaBoost(`linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`, visualMetaBoost);
}
