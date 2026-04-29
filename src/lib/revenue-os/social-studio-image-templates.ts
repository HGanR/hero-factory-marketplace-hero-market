import type { SocialStudioBrandDefaults } from "@/lib/revenue-os/social-studio-brand-defaults";
import type { NativeSocialImageLayout } from "@/lib/revenue-os/native-social-asset-image";
import { buildNativeImageSpecForContent } from "@/lib/revenue-os/social-studio-image-spec";
import { buildNativeImageSpecFromViralContent } from "@/lib/revenue-os/social-studio-from-viral-content";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

/**
 * Deterministic, operator-selectable card layouts (no external image API).
 * Maps to a small set of SVG layout branches in `native-social-asset-image.ts`.
 */
export const SOCIAL_STUDIO_IMAGE_TEMPLATE_IDS = [
  "announcement",
  "quote",
  "offer",
  "event",
  "tip",
  "linkedin_pro",
  "ig_promo",
  "fb_square",
] as const;
export type SocialStudioImageTemplateId = (typeof SOCIAL_STUDIO_IMAGE_TEMPLATE_IDS)[number];

export type SocialStudioImageAspectKey = "og" | "square" | "portrait";

const DIMS: Record<SocialStudioImageAspectKey, { w: number; h: number }> = {
  og: { w: 1200, h: 630 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export const SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG: Record<
  SocialStudioImageTemplateId,
  { label: string; blurb: string; defaultAspect: SocialStudioImageAspectKey; layout: NativeSocialImageLayout }
> = {
  announcement: { label: "Announcement", blurb: "Product / news spotlight", defaultAspect: "og", layout: "card" },
  quote: { label: "Quote / testimonial", blurb: "Attribution-style block", defaultAspect: "square", layout: "quote" },
  offer: { label: "Offer / promo", blurb: "High-contrast CTA", defaultAspect: "square", layout: "promo" },
  event: { label: "Event / live", blurb: "Date-forward layout", defaultAspect: "portrait", layout: "event" },
  tip: { label: "Educational tip", blurb: "Numbered or labeled tip", defaultAspect: "og", layout: "tip" },
  linkedin_pro: { label: "LinkedIn pro", blurb: "Subtle, professional", defaultAspect: "og", layout: "pro" },
  ig_promo: { label: "Instagram promo", blurb: "Bold, square-optimized", defaultAspect: "square", layout: "promo" },
  fb_square: { label: "Facebook square", blurb: "Engagement-optimized 1:1", defaultAspect: "square", layout: "square" },
};

export function resolveTemplateAspectDimensions(
  templateId: SocialStudioImageTemplateId,
  aspect: SocialStudioImageAspectKey
): { width: number; height: number } {
  return { ...DIMS[aspect] };
}

type BuildImageArgs = {
  templateId: SocialStudioImageTemplateId;
  /** Override catalog default (e.g. user picks portrait for announcement) */
  aspect?: SocialStudioImageAspectKey;
  brand: SocialStudioBrandDefaults;
  topic: string;
  businessName?: string;
  contentEngine: ContentEngineOutput | null;
};

/**
 * Produces a render spec for `buildNativeSocialImageSvg` (single deterministic path for generate API + tests).
 */
export function buildNativeSocialImageSpecForStudioTemplate(args: BuildImageArgs) {
  const cat =
    SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[args.templateId] ?? SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG.announcement;
  const aspect = args.aspect ?? cat.defaultAspect;
  const { width, height } = resolveTemplateAspectDimensions(args.templateId, aspect);
  const base = args.contentEngine
    ? buildNativeImageSpecFromViralContent(args.contentEngine, {
        businessName: args.businessName,
        topicFallback: args.topic,
      })
    : ({
        title: args.topic.slice(0, 80),
        subtitle: args.businessName ?? args.brand.brandName,
        line3: "AI Revenue OS · Social Studio",
        width,
        height,
        accent: args.brand.primaryColor,
        background: args.brand.secondaryColor,
      } as const);
  return buildNativeImageSpecForContent(
    {
      ...base,
      width,
      height,
      accent: args.brand.primaryColor,
      background: args.brand.secondaryColor,
    },
    {
      layout: cat.layout,
      brandName: args.brand.brandName,
    }
  );
}
