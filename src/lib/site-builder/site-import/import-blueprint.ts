import { z } from "zod";

export const ImportNavItemSchema = z.object({
  href: z.string().max(2000),
  text: z.string().max(500),
  routeFamily: z.enum(["home", "about", "services", "contact", "faq", "blog", "other"]).optional(),
});

export const ImportSectionImageRoleSchema = z.enum(["hero_candidate", "section", "decorative", "logo", "social"]);

export const ImportSectionSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(["hero", "content", "media", "cta", "nav", "footer", "misc"]),
  heading: z.string().max(500).optional(),
  bodyText: z.string().max(12000).optional(),
  imageUrls: z.array(z.string().max(2000)).max(24).optional(),
  linkHref: z.string().max(2000).optional(),
  linkLabel: z.string().max(300).optional(),
  confidence: z.number().min(0).max(1).optional(),
  /** Heuristic image role for ranking / hero background selection. */
  imageRole: ImportSectionImageRoleSchema.optional(),
  fromOpenGraph: z.boolean().optional(),
  fromCssBackground: z.boolean().optional(),
});

export const ImportBrandSignalsSchema = z.object({
  colors: z.array(z.string().max(80)).max(24).optional(),
  fontFamilies: z.array(z.string().max(200)).max(12).optional(),
  logoUrl: z.string().max(2000).optional(),
});

export const ImportReconstructionMetaSchema = z.object({
  path: z.enum(["native", "semantic_enriched", "metadata_mvp", "invariant_repair"]),
  signals: z
    .object({
      heroIntent: z.boolean().optional(),
      weakExtraction: z.boolean().optional(),
      navPattern: z.enum(["header_nav", "minimal", "dense", "none"]).optional(),
      ctaDensity: z.number().int().min(0).max(80).optional(),
      imageClusterCount: z.number().int().min(0).max(80).optional(),
      marketingStructureScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
  notes: z.array(z.string().max(400)).max(24).optional(),
});

export const ImportBlueprintSchema = z.object({
  version: z.literal(1),
  sourceUrl: z.string().max(2000),
  finalUrl: z.string().max(2000).optional(),
  title: z.string().max(500).optional(),
  /** Open Graph title when present (may differ from <title>). */
  ogTitle: z.string().max(500).optional(),
  metaDescription: z.string().max(2000).optional(),
  lang: z.string().max(16).optional(),
  nav: z.array(ImportNavItemSchema).max(80).optional(),
  footerLinks: z.array(ImportNavItemSchema).max(80).optional(),
  sections: z.array(ImportSectionSchema).max(120),
  brand: ImportBrandSignalsSchema.optional(),
  /** Obvious internal routes discovered (paths only). */
  queuedRoutes: z.array(z.string().max(200)).max(30).optional(),
  notes: z.array(z.string().max(500)).max(50).optional(),
  partial: z.boolean().optional(),
  /** Best hero-style background image URL after ranking (preview hotlink). */
  heroBackgroundImageUrl: z.string().max(2000).optional(),
  /** Filled by semantic reconstruction stage. */
  reconstruction: ImportReconstructionMetaSchema.optional(),
});

export type ImportBlueprint = z.infer<typeof ImportBlueprintSchema>;
export type ImportSection = z.infer<typeof ImportSectionSchema>;
export type ImportNavItem = z.infer<typeof ImportNavItemSchema>;
