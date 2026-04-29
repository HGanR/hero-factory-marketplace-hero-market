/**
 * Cinematic body/shell mapping for static HTML export — mirrors live preview
 * `visualMeta` + theme treatment (no Framer; CSS-only).
 */

import type { SiteSchemaDocumentType, SiteVisualMetaV2 } from "@/lib/site-builder/schema";
import { getCinematicImageOverlayPlaceholderUrl } from "@/lib/site-builder/preview/cinematic-v3-preview-utils";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type CinematicStaticBody = {
  /** Single `style=""` value for <body> */
  bodyStyle: string;
  /** Fixed layers between body and main (readability + lighting) */
  overlayHtml: string;
  /** Classes for <body> */
  bodyClass: string;
  /** Optional :root / body CSS variables for widget + theming */
  styleBlock: string;
};

type ThemeSlice = {
  backgroundMode: string;
  gradientStart: string;
  gradientEnd: string;
  customGradient: string;
  backgroundColor: string;
};

function themeBaseBackground(t: ThemeSlice): string {
  const mode = String(t.backgroundMode || "simple_gradients");
  const gradientStart = String(t.gradientStart || "#0f172a");
  const gradientEnd = String(t.gradientEnd || "#1e293b");
  const customGradient = String(t.customGradient || "");
  const backgroundColor = String(t.backgroundColor || "#020617");
  if (mode === "custom_color") {
    return `background-color:${esc(backgroundColor)};background-image:none;`;
  }
  if (mode === "custom_gradient" && customGradient) {
    return `background:${esc(customGradient)};`;
  }
  if (mode === "abstract_gradients") {
    return "background:radial-gradient(circle at 10% 20%, #312e81, transparent 30%), radial-gradient(circle at 90% 10%, #7c2d12, transparent 35%), radial-gradient(circle at 60% 85%, #14532d, transparent 30%), #020617;";
  }
  if (mode === "simple_gradients") {
    return `background:linear-gradient(135deg, ${esc(gradientStart)}, ${esc(gradientEnd)});`;
  }
  return "background:#020617;";
}

/** gradientStyle + lightingStyle layers (aligned with `cinematic-preview-background` / preview scrim). */
function visualMetaBackgroundLayers(vm: SiteVisualMetaV2): string[] {
  const layers: string[] = [];
  const gs = vm.gradientStyle;
  if (gs === "mesh" || gs === "glass") {
    layers.push("radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 55%)");
  }
  if (gs === "neon" || gs === "radial") {
    layers.push("radial-gradient(circle at 18% 18%, rgba(34,211,238,0.12), transparent 40%)");
  }
  if (gs === "linear") {
    layers.push("linear-gradient(180deg, rgba(15,23,42,0.2), transparent 40%)");
  }
  if (gs === "mesh") {
    layers.push("repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 28px)");
  }
  const ls = vm.lightingStyle;
  if (ls === "neon-glow") {
    layers.push("radial-gradient(circle at 72% 82%, rgba(236,72,153,0.14), transparent 46%)");
  } else if (ls === "ambient") {
    layers.push("radial-gradient(circle at 12% 88%, rgba(14,165,233,0.1), transparent 42%)");
  } else if (ls === "high-contrast") {
    layers.push("radial-gradient(circle at 50% 120%, rgba(15,23,42,0.3), transparent 52%)");
  } else if (ls === "soft") {
    layers.push("radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.08), transparent 50%)");
  }
  if (vm.backgroundStyle === "3d-depth") {
    layers.push("radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0,0,0,0.35), transparent 50%)");
  }
  return layers;
}

function mainStackGradient(theme: ThemeSlice): string {
  const mode = String(theme.backgroundMode || "simple_gradients");
  if (mode === "custom_color") {
    const c = esc(String(theme.backgroundColor || "#020617"));
    return `linear-gradient(180deg,${c},${c})`;
  }
  if (mode === "custom_gradient" && theme.customGradient.trim()) {
    return esc(String(theme.customGradient).trim());
  }
  if (mode === "abstract_gradients") {
    return "radial-gradient(circle at 10% 20%, #312e81, transparent 30%), radial-gradient(circle at 90% 10%, #7c2d12, transparent 35%), radial-gradient(circle at 60% 85%, #14532d, transparent 30%), #020617";
  }
  const gs = esc(String(theme.gradientStart || "#0f172a"));
  const ge = esc(String(theme.gradientEnd || "#1e293b"));
  return `linear-gradient(135deg, ${gs}, ${ge})`;
}

/**
 * Build CSS-only cinematic shell from persisted `metadata.visualMeta` + theme.
 * Merges multi-layer `background` on the body; injects image-overlay when requested.
 * CSS: first `background-image` sub-layer is **topmost**.
 */
export function buildCinematicBackgroundFromVisualMeta(
  visualMeta: SiteVisualMetaV2 | null | undefined,
  theme: ThemeSlice,
  opts?: { seed?: string },
): CinematicStaticBody {
  const seed = opts?.seed ?? "static-export";
  const base = themeBaseBackground(theme);
  if (!visualMeta) {
    return {
      bodyStyle: `${base}min-height:100vh;position:relative;`,
      overlayHtml: "",
      bodyClass: "",
      styleBlock: "",
    };
  }

  const vm = visualMeta;
  const extraLayers = visualMetaBackgroundLayers(vm);
  const main =
    vm.backgroundStyle === "solid"
      ? (() => {
          const c = esc(String(theme.backgroundColor || "#020617"));
          return `linear-gradient(180deg,${c},${c})`;
        })()
      : mainStackGradient(theme);
  const stack = [...extraLayers, main].filter(Boolean);
  const mergedBg = `background-color:#020617;background-image:${stack.join(", ")};background-repeat:no-repeat,no-repeat,no-repeat;`;

  let overlayHtml = "";
  if (vm.backgroundStyle === "image-overlay") {
    const src = getCinematicImageOverlayPlaceholderUrl(seed, 2560);
    const srcEsc = esc(src);
    overlayHtml += `<div class="cinematic-bg-photo" style="position:fixed;inset:0;z-index:0;background-color:#0f172a;background-image:url('${srcEsc}');background-size:cover;background-position:center;filter:saturate(0.9);pointer-events:none" aria-hidden="true"></div>`;
    overlayHtml += `<div class="cinematic-bg-vignette" style="position:fixed;inset:0;z-index:1;background:linear-gradient(180deg,rgba(2,6,23,0.9) 0%,rgba(15,23,42,0.72) 45%,rgba(2,6,23,0.92) 100%),radial-gradient(ellipse 90% 60% at 50% 0%,rgba(99,102,241,0.15),transparent 55%);pointer-events:none" aria-hidden="true"></div>`;
  }

  const gStart = esc(String(theme.gradientStart || "#6366f1"));
  const gEnd = esc(String(theme.gradientEnd || "#22d3ee"));
  const styleBlock = `
:root, body {
  --cinematic-accent: ${gEnd};
  --cinematic-surface: ${gStart};
}`.trim();

  const bodyCore =
    vm.backgroundStyle === "image-overlay"
      ? "background-color:#020617;background-image:none;"
      : mergedBg;

  return {
    bodyStyle: `${bodyCore}min-height:100vh;position:relative;isolation:isolate;`,
    overlayHtml,
    bodyClass: " cinematic-v2",
    styleBlock,
  };
}

export function staticMotionClassFromBlock(block: unknown): string {
  const m = (block as { content?: { motion?: { cinematic?: { type?: string } } } })?.content?.motion;
  const t = m?.cinematic?.type;
  if (t === "fade") return "thz-static-motion-fade";
  if (t === "slide") return "thz-static-motion-slide";
  if (t === "parallax") return "thz-static-motion-parallax";
  return "";
}

/**
 * When visualMeta is set, add extra gradient stack inside hero (preview parity) if the block gradient is minimal.
 */
export function heroCinematicStackCss(visual: Record<string, unknown>, hasDocMeta: boolean): string {
  if (!hasDocMeta) return "";
  const g = String(visual.gradient || "");
  if (g && g.length > 40) return "";
  return "background-image:radial-gradient(ellipse 90% 80% at 12% 0%, rgba(99,102,241,0.2), transparent 50%), linear-gradient(145deg, rgba(30,27,75,0.95), rgba(15,23,42,0.98));";
}

export function buildSectionWrap(
  index: number,
  inner: string,
  content: { visualEngine?: { sectionTone?: string } } | undefined,
  hasVisualMeta: boolean,
  motionClass: string,
): string {
  const mc = motionClass.trim();
  if (!hasVisualMeta) {
    return mc ? `<div class="${mc}">${inner}</div>` : inner;
  }
  const ve = content?.visualEngine;
  const tone = ve?.sectionTone;
  const alt = index % 2;
  const toneClass =
    tone === "light"
      ? "cine-sec--light"
      : tone === "visual"
        ? "cine-sec--visual"
        : tone === "dark"
          ? "cine-sec--dark"
          : alt === 0
            ? "cine-sec--a"
            : "cine-sec--b";
  const motionPart = mc ? ` ${mc}` : "";
  return `<div class="cine-sec ${toneClass}${motionPart}">${inner}</div>`;
}

export function themeSpacingForVisualMeta(schema: SiteSchemaDocumentType): string {
  const has = Boolean(schema.metadata?.visualMeta);
  if (!has) return "";
  return "row-gap:clamp(18px,2.8vw,28px);";
}
