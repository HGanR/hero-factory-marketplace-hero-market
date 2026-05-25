/**
 * Detect site-wide / brand-level instructions that should update `metadata.designSystem`
 * instead of repeatedly patching individual sections.
 */

import {
  type DesignSystem,
  type DesignTokenMutationKind,
  ensureDesignSystemOnDocument,
  hydrateDesignSystemBindingsOnDocument,
} from "@/lib/site-builder/design-system";
import { getPalette } from "@/lib/site-builder/ai/visual-tokens";
import type { StyleMode } from "@/lib/site-builder/ai/visual-tokens";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

type MetadataPartial = Partial<NonNullable<SiteSchemaDocumentType["metadata"]>>;
type SiteMetadata = NonNullable<SiteSchemaDocumentType["metadata"]>;
type ThemeRow = NonNullable<SiteMetadata["theme"]>;

function normalizeDocMetadata(doc: SiteSchemaDocumentType): SiteMetadata {
  const prev: MetadataPartial = doc.metadata ?? {};
  return {
    title: typeof prev.title === "string" && prev.title.trim() ? prev.title : "Site",
    removeDefaultCss: prev.removeDefaultCss ?? false,
    governance: prev.governance ?? {},
    ...prev,
  };
}

function assignMetadataWithTheme(doc: SiteSchemaDocumentType, themePatch: Partial<ThemeRow>): void {
  const meta = normalizeDocMetadata(doc);
  const t: Partial<ThemeRow> = meta.theme ?? {};
  doc.metadata = {
    ...meta,
    theme: {
      backgroundMode: t.backgroundMode ?? "simple_gradients",
      mediaType: t.mediaType ?? "image",
      ...t,
      ...themePatch,
    },
  };
}

export function isGlobalDesignTokenInstruction(instruction: string): boolean {
  const t = instruction.trim().toLowerCase();
  if (!t) return false;
  const siteWide =
    /\b(site-?wide|whole site|entire site|all pages|across (the )?site|every section|all sections|globally|everywhere on (the )?(site|page))\b/.test(
      t,
    );
  const tokenCue =
    /\b(brand|design system|tokens?|palette|spacing|shadows?|motion|density|background)\b/.test(t);
  const whiteLight =
    /\b(white background|light background|light mode)\b/.test(t) && /\b(site|whole|all|every|across|everywhere)\b/.test(t);
  const minimalGlobal =
    /\b(everything|whole site|all sections)\b/.test(t) && /\b(minimal|cleaner|less busy)\b/.test(t);
  const spacingGlobal =
    /\b(tighten spacing|more compact|more air|more spacious)\b/.test(t) &&
    (siteWide || /\b(everywhere|whole|all sections)\b/.test(t));
  const premiumGlobal =
    /\b(more premium|luxury|elevated)\b/.test(t) && (siteWide || /\b(site|whole page)\b/.test(t));

  return siteWide && tokenCue || whiteLight || minimalGlobal || spacingGlobal || premiumGlobal;
}

function applyLightSiteTheme(doc: SiteSchemaDocumentType, ds: DesignSystem): DesignTokenMutationKind[] {
  const kinds: DesignTokenMutationKind[] = ["color"];
  ds.colors.background = "#ffffff";
  ds.colors.surface = "#f8fafc";
  ds.colors.surfaceElevated = "#f1f5f9";
  ds.colors.text = "#0f172a";
  ds.colors.textMuted = "#64748b";
  ds.colors.border = "rgba(15,23,42,0.12)";
  ds.colors.primary = "#0f172a";
  ds.colors.accent = "#0d9488";
  ds.shadow = {
    sm: "0 1px 2px rgba(15,23,42,0.06)",
    md: "0 6px 20px rgba(15,23,42,0.08)",
    lg: "0 14px 40px rgba(15,23,42,0.1)",
  };
  assignMetadataWithTheme(doc, {
    styleMode: "minimal",
    backgroundMode: "simple_gradients",
    gradientStart: "#f8fafc",
    gradientEnd: "#e2e8f0",
  });
  return kinds;
}

function applyMinimalPreset(doc: SiteSchemaDocumentType, ds: DesignSystem, mode: StyleMode): DesignTokenMutationKind[] {
  const p = getPalette(mode);
  ds.density = "compact";
  ds.spacing.sectionY = "2.25rem";
  ds.shadow = {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 14px rgba(0,0,0,0.08)",
    lg: "0 12px 28px rgba(0,0,0,0.1)",
  };
  ds.motion.intensity = Math.max(12, ds.motion.intensity - 18);
  ds.colors.accent = p.accent;
  ds.colors.primary = p.accent;
  assignMetadataWithTheme(doc, { styleMode: "minimal" });
  return ["density", "shadow", "motion", "color"];
}

function applyPremiumBump(ds: DesignSystem): DesignTokenMutationKind[] {
  ds.shadow.lg = "0 28px 64px rgba(0,0,0,0.38)";
  ds.motion.intensity = Math.min(100, ds.motion.intensity + 14);
  return ["shadow", "motion"];
}

function applySpacingTight(ds: DesignSystem): DesignTokenMutationKind[] {
  ds.density = "compact";
  ds.spacing.sectionY = "2.1rem";
  ds.spacing.md = "0.5rem";
  return ["spacing", "density"];
}

function applySpacingSpacious(ds: DesignSystem): DesignTokenMutationKind[] {
  ds.density = "spacious";
  ds.spacing.sectionY = "4.25rem";
  ds.spacing.md = "1rem";
  return ["spacing", "density"];
}

/**
 * Mutates `doc` when instruction matches global token patterns. Returns kinds applied.
 */
export function applyGlobalDesignTokenInstruction(
  doc: SiteSchemaDocumentType,
  instruction: string,
): { applied: boolean; kinds: DesignTokenMutationKind[] } {
  if (!isGlobalDesignTokenInstruction(instruction)) {
    return { applied: false, kinds: [] };
  }
  const t = instruction.toLowerCase();
  const ds = ensureDesignSystemOnDocument(doc);
  const kinds = new Set<DesignTokenMutationKind>();

  if (
    /\b(white|off-?white|light)\b.*\b(background|mode)\b/.test(t) ||
    /\b(light background|white background)\b/.test(t)
  ) {
    applyLightSiteTheme(doc, ds).forEach((k) => kinds.add(k));
  }

  if (/\b(more minimal|cleaner site|less busy|softer shadows)\b/.test(t)) {
    applyMinimalPreset(doc, ds, "minimal").forEach((k) => kinds.add(k));
  }

  if (/\b(more premium|luxury|elevated)\b/.test(t)) {
    applyPremiumBump(ds).forEach((k) => kinds.add(k));
  }

  if (/\b(tighten spacing|more compact)\b/.test(t)) {
    applySpacingTight(ds).forEach((k) => kinds.add(k));
  }

  if (/\b(more air|more spacious|looser spacing)\b/.test(t)) {
    applySpacingSpacious(ds).forEach((k) => kinds.add(k));
  }

  if (/\b(web3|neon|glow)\b/.test(t) && /\b(site|whole|brand)\b/.test(t)) {
    assignMetadataWithTheme(doc, { styleMode: "web3" });
    const p = getPalette("web3");
    ds.colors.accent = p.accent;
    ds.colors.primary = p.accent;
    ds.motion.intensity = Math.min(100, ds.motion.intensity + 20);
    kinds.add("color");
    kinds.add("motion");
  }

  if (kinds.size === 0) {
    return { applied: false, kinds: [] };
  }

  hydrateDesignSystemBindingsOnDocument(doc);
  const meta = normalizeDocMetadata(doc);
  const g = meta.governance;
  doc.metadata = {
    ...meta,
    governance: {
      ...(typeof g === "object" && g ? g : {}),
      lastTokenPropagationAt: new Date().toISOString(),
    },
  };

  return { applied: true, kinds: [...kinds] };
}
