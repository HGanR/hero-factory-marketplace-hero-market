/**
 * Stable schemas for preview vs static export parity checks (CI / Playwright).
 *
 * Representative flow (same for every style mode):
 *   hero → trust strip → stat band → feature image grid → CTA
 *
 * Determinism: hero `animateBackground` is forced off so export CSS keyframes do not
 * cause screenshot drift; copy and data-URI images are fixed.
 */

import { applyTroothertzVisualPostProcessToDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import {
  buildSectionVisualLayers,
  getEngineProfile,
  getPalette,
  type StyleMode,
} from "@/lib/site-builder/ai/visual-tokens";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const PLACEHOLDER_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect fill="#1e293b" width="120" height="120" rx="12"/><text x="60" y="66" fill="#94a3b8" font-size="11" font-family="system-ui" text-anchor="middle">feat</text></svg>`,
  );

function baseHeroVisual(mode: StyleMode) {
  const profile = getEngineProfile(mode);
  const layers = buildSectionVisualLayers(mode, "parity-fixture", profile);
  const p = getPalette(mode);
  return {
    gradient: layers.gradient,
    glowShadow: layers.glowShadow,
    noise: layers.noiseOpacity,
    gridOverlay: layers.gridOpacity,
    /** Off for visual-diff stability (parity tests); live AI output may animate. */
    animateBackground: false,
    accent: p.accent,
    ...(layers.ambientGlow ? { ambientGlow: layers.ambientGlow } : {}),
    anchor: mode === "bold" ? "holographic" : mode === "web3" ? "neural" : "depth",
  };
}

function baseMetadata(mode: StyleMode) {
  return {
    title: `Parity ${mode}`,
    description: "Internal parity fixture",
    theme: {
      name: `parity-${mode}`,
      backgroundMode: "simple_gradients" as const,
      gradientStart: "#0f172a",
      gradientEnd: "#1e293b",
      styleMode: mode,
    },
  };
}

/**
 * Representative site: same section flow for every style mode; troothertz post-process applied.
 */
export function buildSiteBuilderParityFixture(mode: StyleMode): SiteSchemaDocumentType {
  const raw = {
    metadata: baseMetadata(mode),
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero" as const,
            content: {
              title: "Launch with operator-grade clarity",
              subtitle: "Proof-first narrative — calm motion, restrained density.",
              layout: "stack",
              visual: baseHeroVisual(mode),
            },
          },
          {
            type: "list" as const,
            content: {
              variant: "trust_strip",
              items: ["SOC2-ready posture", "Wallet-native flows", "Operator audit trail"],
              visual: {
                accent: getPalette(mode).accent,
              },
            },
          },
          {
            type: "stat_band" as const,
            content: {
              stats: [
                { value: "99.2%", label: "Uptime" },
                { value: "48ms", label: "p95" },
                { value: "12", label: "Regions" },
              ],
              visual: {
                gradient: "linear-gradient(90deg, transparent, rgba(56,189,248,0.14), transparent)",
                ringAccent: getPalette(mode).accent,
                edgeGlow: mode === "bold" || mode === "web3",
              },
            },
          },
          {
            type: "image_grid" as const,
            content: {
              images: [
                { src: PLACEHOLDER_IMG, alt: "Feature A" },
                { src: PLACEHOLDER_IMG, alt: "Feature B" },
                { src: "", alt: "Feature C" },
                { src: "", alt: "Feature D" },
              ],
            },
          },
          {
            type: "call_to_action" as const,
            content: {
              title: "Ship the next version",
              body: "One obvious next step — no clutter.",
              label: "Continue",
              href: "#",
            },
          },
        ],
      },
    ],
  };

  const parsed = SiteSchemaDocument.parse(raw);
  return applyTroothertzVisualPostProcessToDocument(parsed, mode);
}

export const SITE_BUILDER_PARITY_MODES: StyleMode[] = ["web3", "corporate", "minimal", "bold"];
