import { z } from "zod";

/** Canonical design tokens persisted on `metadata.designSystem`. */
export const DesignSystemSchema = z.object({
  version: z.literal(1),
  colors: z.object({
    primary: z.string().max(80),
    accent: z.string().max(80),
    background: z.string().max(80),
    surface: z.string().max(80),
    surfaceElevated: z.string().max(80).optional(),
    text: z.string().max(80),
    textMuted: z.string().max(80),
    border: z.string().max(120).optional(),
  }),
  typography: z.object({
    fontSans: z.string().max(400),
    scaleRootPx: z.number().min(12).max(22),
    weightNormal: z.number(),
    weightSemibold: z.number(),
    weightBold: z.number(),
  }),
  spacing: z.object({
    sectionY: z.string().max(32),
    xs: z.string().max(24),
    sm: z.string().max(24),
    md: z.string().max(24),
    lg: z.string().max(24),
    xl: z.string().max(24),
  }),
  radius: z.object({
    sm: z.string().max(24),
    md: z.string().max(24),
    lg: z.string().max(24),
  }),
  shadow: z.object({
    sm: z.string().max(200),
    md: z.string().max(200),
    lg: z.string().max(200),
  }),
  motion: z.object({
    durationFast: z.string().max(24),
    durationBase: z.string().max(24),
    easingStandard: z.string().max(80),
    intensity: z.number().min(0).max(100),
  }),
  density: z.enum(["compact", "comfortable", "spacious"]),
  /** Enforced builder lock — spacing/typography/CTA conformity for generated blocks. */
  lock: z
    .object({
      sectionPaddingPx: z.object({
        tight: z.number().min(4).max(48),
        balanced: z.number().min(8).max(64),
        spacious: z.number().min(12).max(96),
      }),
      typographyRem: z.object({
        body: z.number().min(0.75).max(1.35),
        lead: z.number().min(0.85).max(1.5),
        display: z.number().min(1.5).max(4),
      }),
      cta: z.object({
        paddingY: z.string().max(24),
        paddingX: z.string().max(24),
        borderRadius: z.string().max(24),
        fontWeight: z.number().min(500).max(900),
        boxShadow: z.string().max(200).optional(),
      }),
    })
    .optional(),
});

export type DesignSystem = z.infer<typeof DesignSystemSchema>;

export const SiteGovernanceMetaSchema = z
  .object({
    brandPassVersion: z.number().int().optional(),
    lastAlignedAt: z.string().max(80).optional(),
    lastTokenPropagationAt: z.string().max(80).optional(),
  })
  .optional();
