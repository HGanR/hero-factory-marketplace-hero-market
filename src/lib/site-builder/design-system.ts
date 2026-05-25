/**
 * Global design tokens for site-builder — stored on `metadata.designSystem`.
 * Client-safe (no Node imports). Used by generation, governance, export (:root vars), and token-level edits.
 */

import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { DesignSystemSchema, type DesignSystem } from "@/lib/site-builder/design-system-schema";
import { effectiveStyleModeFromPlanner, type StyleMode } from "@/lib/site-builder/ai/visual-tokens";
import { getPalette } from "@/lib/site-builder/ai/visual-tokens";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export { DesignSystemSchema };
export type { DesignSystem };

const FONT_STACK = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;

function shadowsForMode(mode: StyleMode): DesignSystem["shadow"] {
  switch (mode) {
    case "minimal":
      return {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 4px 14px rgba(0,0,0,0.08)",
        lg: "0 12px 28px rgba(0,0,0,0.1)",
      };
    case "web3":
      return {
        sm: "0 0 20px rgba(34,211,238,0.12)",
        md: "0 0 40px rgba(99,102,241,0.22), 0 12px 40px rgba(0,0,0,0.35)",
        lg: "0 0 56px rgba(34,211,238,0.2), 0 24px 64px rgba(0,0,0,0.45)",
      };
    case "bold":
      return {
        sm: "0 2px 8px rgba(244,114,182,0.15)",
        md: "0 12px 36px rgba(88,28,135,0.35)",
        lg: "0 24px 56px rgba(190,24,93,0.25)",
      };
    default:
      return {
        sm: "0 1px 3px rgba(0,0,0,0.12)",
        md: "0 8px 28px rgba(0,0,0,0.22)",
        lg: "0 18px 48px rgba(0,0,0,0.32)",
      };
  }
}

function designSystemLockForMode(mode: StyleMode, density: DesignSystem["density"]): NonNullable<DesignSystem["lock"]> {
  const tightPad = mode === "minimal" ? 10 : density === "compact" ? 11 : 12;
  const balPad = mode === "minimal" ? 14 : 16;
  const spaPad = mode === "minimal" ? 20 : density === "spacious" ? 26 : 22;
  const typo =
    mode === "bold"
      ? { body: 1.05, lead: 1.18, display: 2.85 }
      : mode === "minimal"
        ? { body: 0.95, lead: 1.05, display: 2.35 }
        : { body: 1, lead: 1.12, display: 2.55 };
  return {
    sectionPaddingPx: { tight: tightPad, balanced: balPad, spacious: spaPad },
    typographyRem: typo,
    cta: {
      paddingY: mode === "minimal" ? "0.7rem" : "0.9rem",
      paddingX: mode === "minimal" ? "1.25rem" : "1.6rem",
      borderRadius: mode === "minimal" ? "10px" : "14px",
      fontWeight: 700,
      boxShadow: mode === "web3" ? "0 0 28px rgba(34,211,238,0.22)" : mode === "bold" ? "0 12px 32px rgba(88,28,135,0.28)" : undefined,
    },
  };
}

function spacingForDensity(density: DesignSystem["density"], mode: StyleMode): DesignSystem["spacing"] {
  const tight = mode === "minimal" || density === "compact";
  const loose = density === "spacious";
  const base = tight ? "0.5rem" : loose ? "1rem" : "0.75rem";
  return {
    sectionY: tight ? "2.25rem" : loose ? "4.5rem" : "3.25rem",
    xs: tight ? "0.25rem" : loose ? "0.5rem" : "0.375rem",
    sm: tight ? "0.5rem" : loose ? "0.875rem" : "0.625rem",
    md: base,
    lg: tight ? "1rem" : loose ? "1.75rem" : "1.25rem",
    xl: tight ? "1.5rem" : loose ? "2.5rem" : "2rem",
  };
}

/** Preset from styleMode + optional planner / theme overrides. */
export function buildDesignSystemFromPlanner(planner: SitePlannerOutput): DesignSystem {
  const mode = effectiveStyleModeFromPlanner(planner);
  const p = getPalette(mode);
  const dt = planner.designTokens;
  const accent = (dt.accent?.trim() || p.accent).slice(0, 80);
  const bg = (dt.gradientStart?.trim() || (mode === "minimal" ? "#0f172a" : "#0f172a")).slice(0, 80);
  const bg2 = (dt.gradientEnd?.trim() || (mode === "minimal" ? "#1e293b" : "#1e293b")).slice(0, 80);
  const density: DesignSystem["density"] =
    mode === "minimal" ? "compact" : mode === "bold" ? "comfortable" : "comfortable";
  const motionI = dt.motionIntensity ?? (mode === "web3" ? 72 : mode === "bold" ? 68 : 42);

  return DesignSystemSchema.parse({
    version: 1,
    colors: {
      primary: accent,
      accent,
      background: bg,
      surface: p.surface.slice(0, 80),
      surfaceElevated: mode === "minimal" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
      text: mode === "minimal" ? "#f1f5f9" : "#f8fafc",
      textMuted: p.muted.slice(0, 80),
      border: "rgba(148,163,184,0.22)",
    },
    typography: {
      fontSans: FONT_STACK,
      scaleRootPx: mode === "minimal" ? 15 : 16,
      weightNormal: 400,
      weightSemibold: 600,
      weightBold: 700,
    },
    spacing: spacingForDensity(density, mode),
    radius: mode === "minimal" ? { sm: "6px", md: "10px", lg: "14px" } : { sm: "8px", md: "12px", lg: "16px" },
    shadow: shadowsForMode(mode),
    motion: {
      durationFast: mode === "web3" ? "0.12s" : "0.15s",
      durationBase: mode === "web3" ? "0.42s" : "0.35s",
      easingStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
      intensity: motionI,
    },
    density,
    lock: designSystemLockForMode(mode, density),
  });
}

/** Derive tokens from theme only (legacy / import schemas). */
export function designSystemFromThemeSnapshot(theme: {
  styleMode?: StyleMode;
  gradientStart?: string;
  gradientEnd?: string;
}): DesignSystem {
  const mode = theme.styleMode ?? "corporate";
  const p = getPalette(mode);
  const accent = p.accent.slice(0, 80);
  const density: DesignSystem["density"] =
    mode === "minimal" ? "compact" : mode === "bold" ? "comfortable" : "comfortable";
  return DesignSystemSchema.parse({
    version: 1,
    colors: {
      primary: accent,
      accent,
      background: (theme.gradientStart || "#0f172a").slice(0, 80),
      surface: p.surface.slice(0, 80),
      surfaceElevated: "rgba(255,255,255,0.06)",
      text: "#f8fafc",
      textMuted: p.muted.slice(0, 80),
      border: "rgba(148,163,184,0.22)",
    },
    typography: {
      fontSans: FONT_STACK,
      scaleRootPx: mode === "minimal" ? 15 : 16,
      weightNormal: 400,
      weightSemibold: 600,
      weightBold: 700,
    },
    spacing: spacingForDensity(density, mode),
    radius: { sm: "8px", md: "12px", lg: "16px" },
    shadow: shadowsForMode(mode),
    motion: {
      durationFast: "0.15s",
      durationBase: "0.35s",
      easingStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
      intensity: mode === "web3" ? 70 : 45,
    },
    density,
    lock: designSystemLockForMode(mode, density),
  });
}

export function ensureDesignSystemOnDocument(doc: SiteSchemaDocumentType): DesignSystem {
  const parsed = DesignSystemSchema.safeParse(doc.metadata?.designSystem);
  if (parsed.success) {
    if (parsed.data.lock) return parsed.data;
    const mode = (doc.metadata?.theme?.styleMode ?? "corporate") as StyleMode;
    const withLock = DesignSystemSchema.parse({
      ...parsed.data,
      lock: designSystemLockForMode(mode, parsed.data.density),
    });
    const prev: Partial<NonNullable<SiteSchemaDocumentType["metadata"]>> = doc.metadata ?? {};
    const meta: NonNullable<SiteSchemaDocumentType["metadata"]> = {
      title: typeof prev.title === "string" && prev.title.trim() ? prev.title : "Site",
      removeDefaultCss: prev.removeDefaultCss ?? false,
      governance: prev.governance ?? {},
      ...prev,
      designSystem: withLock,
    };
    doc.metadata = meta;
    return withLock;
  }
  type ThemeRow = NonNullable<NonNullable<SiteSchemaDocumentType["metadata"]>["theme"]>;
  const theme: Partial<ThemeRow> = doc.metadata?.theme ?? {};
  const ds = designSystemFromThemeSnapshot({
    styleMode: theme.styleMode,
    gradientStart: theme.gradientStart,
    gradientEnd: theme.gradientEnd,
  });
  const prevMeta: Partial<NonNullable<SiteSchemaDocumentType["metadata"]>> = doc.metadata ?? {};
  const meta: NonNullable<SiteSchemaDocumentType["metadata"]> = {
    title: typeof prevMeta.title === "string" && prevMeta.title.trim() ? prevMeta.title : "Site",
    removeDefaultCss: prevMeta.removeDefaultCss ?? false,
    governance: prevMeta.governance ?? {},
    ...prevMeta,
    designSystem: ds,
  };
  doc.metadata = meta;
  return ds;
}

/** Merge planner accent / motion into existing DS (e.g. after planner refresh). */
export function mergePlannerIntoDesignSystem(ds: DesignSystem, planner: SitePlannerOutput): DesignSystem {
  const next = buildDesignSystemFromPlanner(planner);
  return DesignSystemSchema.parse({
    ...ds,
    colors: { ...ds.colors, primary: next.colors.primary, accent: next.colors.accent },
    motion: { ...ds.motion, intensity: next.motion.intensity },
    shadow: next.shadow,
    spacing: next.spacing,
    lock: next.lock ?? ds.lock,
  });
}

export function designSystemToCssRootBlock(ds: DesignSystem): string {
  const { colors, typography, spacing, radius, shadow, motion, density } = ds;
  return `/* Design system tokens — metadata.designSystem */
:root{
  --ds-color-primary:${colors.primary};
  --ds-color-accent:${colors.accent};
  --ds-color-background:${colors.background};
  --ds-color-surface:${colors.surface};
  --ds-color-surface-elevated:${colors.surfaceElevated ?? colors.surface};
  --ds-color-text:${colors.text};
  --ds-color-text-muted:${colors.textMuted};
  --ds-color-border:${colors.border ?? "rgba(148,163,184,0.2)"};
  --ds-font-sans:${typography.fontSans};
  --ds-font-root-px:${typography.scaleRootPx}px;
  --ds-weight-normal:${typography.weightNormal};
  --ds-weight-semibold:${typography.weightSemibold};
  --ds-weight-bold:${typography.weightBold};
  --ds-space-section-y:${spacing.sectionY};
  --ds-space-xs:${spacing.xs};
  --ds-space-sm:${spacing.sm};
  --ds-space-md:${spacing.md};
  --ds-space-lg:${spacing.lg};
  --ds-space-xl:${spacing.xl};
  --ds-radius-sm:${radius.sm};
  --ds-radius-md:${radius.md};
  --ds-radius-lg:${radius.lg};
  --ds-shadow-sm:${shadow.sm};
  --ds-shadow-md:${shadow.md};
  --ds-shadow-lg:${shadow.lg};
  --ds-motion-fast:${motion.durationFast};
  --ds-motion-base:${motion.durationBase};
  --ds-motion-ease:${motion.easingStandard};
  --ds-motion-intensity:${motion.intensity};
  --ds-density:${density};
}
`;
}

/** Mark blocks so static export can emit var(--ds-*) for bound roles. */
export function hydrateDesignSystemBindingsOnDocument(doc: SiteSchemaDocumentType): void {
  ensureDesignSystemOnDocument(doc);
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const t = String(block.type);
      if (!["hero", "call_to_action", "stat_band", "visual_break", "button", "big_link"].includes(t)) continue;
      const raw = block.content;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const content = { ...(raw as Record<string, unknown>) };
      const vis =
        content.visual && typeof content.visual === "object" && !Array.isArray(content.visual)
          ? { ...(content.visual as Record<string, unknown>) }
          : {};
      vis.ds = {
        accent: "colors.accent",
        primary: "colors.primary",
        textMuted: "colors.textMuted",
      };
      content.visual = vis;
      (block as { content: unknown }).content = content;
    }
  }
}

export type DesignTokenMutationKind = "color" | "spacing" | "motion" | "shadow" | "density" | "typography";
