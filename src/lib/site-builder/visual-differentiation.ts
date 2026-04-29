/**
 * Post-generation visual pass: stronger hero hierarchy, CTA emphasis, contrast, motion polish.
 */

import { ensureHeroCinematicQuality } from "@/lib/site-builder/ai/cinematic-visual-injection";
import { getCinematicStylePresetForLayoutFamily } from "@/lib/site-builder/ai/cinematic-styles";
import { DesignSystemSchema, type DesignSystem } from "@/lib/site-builder/design-system-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function boostMutedHex(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) * 1.08 + 6));
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) * 1.08 + 6));
  const b = Math.min(255, Math.round((n & 0xff) * 1.08 + 6));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function bumpHeadlineScale(scale: unknown): string {
  const order = ["hero-md", "hero-lg", "hero-xl"];
  const s = typeof scale === "string" ? scale : "";
  const i = order.indexOf(s);
  if (i < 0) return "hero-xl";
  return order[Math.min(order.length - 1, i + 1)]!;
}

export function applyVisualDifferentiationPass(doc: SiteSchemaDocumentType, layoutFamilyId?: string): void {
  const meta = doc.metadata;
  if (meta?.designSystem) {
    const parsed = DesignSystemSchema.safeParse(meta.designSystem);
    if (parsed.success) {
      const tm = parsed.data.colors.textMuted;
      const nextColors = {
        ...parsed.data.colors,
        textMuted: tm.startsWith("#") ? boostMutedHex(tm) : tm,
        border: "rgba(148,163,184,0.32)",
      };
      const nextDs: DesignSystem = DesignSystemSchema.parse({
        ...parsed.data,
        colors: nextColors,
        motion: {
          ...parsed.data.motion,
          intensity: Math.min(100, parsed.data.motion.intensity + 6),
        },
      });
      doc.metadata = { ...meta, designSystem: nextDs };
    }
  }

  const heroTone = getCinematicStylePresetForLayoutFamily(layoutFamilyId)?.typographyTone ?? "editorial";
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      if (String(block.type) === "hero") {
        ensureHeroCinematicQuality(block, { typographyTone: heroTone });
        const raw = block.content;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const c = { ...(raw as Record<string, unknown>) };
          c.headlineScale = bumpHeadlineScale(c.headlineScale);
          const vis =
            c.visual && typeof c.visual === "object" && !Array.isArray(c.visual)
              ? { ...(c.visual as Record<string, unknown>) }
              : {};
          vis.heroContrastBoost = true;
          c.visual = vis;
          (block as { content: unknown }).content = c;
        }
      }
      if (String(block.type) === "call_to_action") {
        const raw = block.content;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const c = { ...(raw as Record<string, unknown>) };
          const vis =
            c.visual && typeof c.visual === "object" && !Array.isArray(c.visual)
              ? { ...(c.visual as Record<string, unknown>) }
              : {};
          vis.ctaEmphasis = true;
          vis.conversionHighlight = true;
          c.visual = vis;
          (block as { content: unknown }).content = c;
        }
      }
    }
  }
}
