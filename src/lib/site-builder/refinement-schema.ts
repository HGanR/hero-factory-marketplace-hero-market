import { z } from "zod";

export const DeploymentTargetSchema = z.enum([
  "static",
  "vercel_nextjs",
  "netlify_static",
  "ipfs",
  "wordpress_theme",
  "gohighlevel_embed",
  "custom",
]);

export type DeploymentTarget = z.infer<typeof DeploymentTargetSchema>;

export const RoutingModeSchema = z.enum(["single_page", "multi_page"]);
export type RoutingMode = z.infer<typeof RoutingModeSchema>;

export const AssetStrategySchema = z.enum(["local_bundle", "remote_urls"]);
export type AssetStrategy = z.infer<typeof AssetStrategySchema>;

/** Answers from the guided refinement step in the AI panel (stored on schema.metadata.builderRefinement). */
export const SiteBuilderRefinementAnswersSchema = z.object({
  heroBackgroundType: z.enum(["color", "image", "video"]).optional(),
  /** Hex color, image URL, or video URL */
  heroBackgroundValue: z.string().max(2000).optional(),
  heroBackgroundBehavior: z.enum(["scroll", "fixed", "parallax"]).optional(),
  heroBackgroundFallbackColor: z.string().max(40).optional(),
  /** How image/video background is supplied (color backgrounds ignore this). */
  heroBackgroundSource: z.enum(["url", "upload"]).optional(),
  /** When set, `metadata.siteBuilderAssets[assetId]` holds the upload record. */
  heroBackgroundAssetId: z.string().uuid().optional(),
  mediaPreference: z.enum(["generated", "upload_or_url"]).optional(),
  colorScheme: z.enum(["light", "dark", "dark_default", "custom"]).optional(),
  motionFeel: z.enum(["animated", "reduced"]).optional(),
  deploymentTarget: DeploymentTargetSchema.optional(),
  routingMode: RoutingModeSchema.optional(),
  assetStrategy: AssetStrategySchema.optional(),
});

export type SiteBuilderRefinementAnswers = z.infer<typeof SiteBuilderRefinementAnswersSchema>;

export const VisualBackgroundSchema = z.object({
  type: z.enum(["color", "image", "video"]),
  value: z.string().max(2000).optional(),
  assetId: z.string().uuid().optional(),
  behavior: z.enum(["scroll", "fixed", "parallax"]).default("scroll"),
  fallbackColor: z.string().max(40).optional(),
  mimeType: z.string().max(120).optional(),
});

export type VisualBackground = z.infer<typeof VisualBackgroundSchema>;
