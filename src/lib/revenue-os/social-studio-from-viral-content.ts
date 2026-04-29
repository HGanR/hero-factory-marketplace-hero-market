import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { NativeSocialImageSpec } from "@/lib/revenue-os/native-social-asset-image";
import type { PlatformCaptionVariant, StudioPlatform } from "@/lib/revenue-os/social-studio-captions";
import { buildPlatformCaptionVariants } from "@/lib/revenue-os/social-studio-captions";

const LI_MAX = 3000;
const IG_MAX = 2200;
const FB_MAX = 5000;
const TIKTOK_MAX = 2200;

function str(s: string | null | undefined, max: number): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Derive Social Studio “topic” line from Generate Viral Content output (or empty). */
export function topicFromViralContent(ce: ContentEngineOutput, fallback: string): string {
  const hook = str(ce.captions?.hook, 200);
  if (hook) return hook;
  const capLine = str(ce.fullPost?.caption, 200);
  if (capLine) return capLine.split("\n")[0] ?? capLine;
  const h0 = ce.hooks?.[0] ? str(ce.hooks[0], 200) : "";
  if (h0) return h0;
  return fallback.trim() || "Campaign highlight";
}

function hashtagStr(ce: ContentEngineOutput, fallback: string): string {
  const tags = ce.fullPost?.hashtags?.filter(Boolean) ?? [];
  if (tags.length) return tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  return fallback;
}

/**
 * Per-platform copy + image prompts from Content Engine (Generate Viral Content).
 * Falls back to template-only when fields are empty.
 */
export function buildPlatformCaptionVariantsFromViralContent(args: {
  topic: string;
  businessName?: string;
  contentEngine: ContentEngineOutput;
}): PlatformCaptionVariant[] {
  const ce = args.contentEngine;
  const brand = str(args.businessName ?? "Your brand", 80);
  const topic = str(args.topic, 200);
  const hook = str(ce.captions?.hook, 400) || topic;
  const authority = str(ce.captions?.authority, 500);
  const shortV = str(ce.captions?.shortViral, 500);
  const cap = str(ce.fullPost?.caption, 1200);
  const body = str(ce.fullPost?.content, 2000);
  const visual = str(ce.fullPost?.visualPrompt, 500) || str(ce.imagePrompts?.[0], 500) || `Visual for ${hook}`;

  const base: Record<StudioPlatform, PlatformCaptionVariant> = {
    linkedin: {
      platform: "linkedin",
      caption: [hook, authority, body || cap, "", `— ${brand}`].filter(Boolean).join("\n\n").slice(0, LI_MAX),
      hashtags: hashtagStr(ce, "#Leadership #Growth #Business").slice(0, 1000),
      imagePrompt: `${visual} — professional editorial, wide format, no overlaid text in image`,
      aspectRatio: "1.91:1 (share) or 1:1",
      aspectRatioLabel: "LinkedIn (landscape or square)",
      previewHint: "From Viral Content: hook + authority + long-form.",
    },
    instagram: {
      platform: "instagram",
      caption: [shortV || cap || hook, "", cap && cap !== (shortV || hook) ? cap : "", "", hashtagStr(ce, "#Reels #Brand #Community")].filter(Boolean).join("\n\n").slice(0, IG_MAX),
      hashtags: hashtagStr(ce, "#Reels #Brand #Community").slice(0, 1000),
      imagePrompt: `${visual} — bold mobile feed aesthetic, no fine print in frame`,
      aspectRatio: "4:5 feed / 9:16 story",
      aspectRatioLabel: "Instagram (4:5 or 9:16)",
      previewHint: "From Viral Content: shortViral + caption + hashtags.",
    },
    facebook: {
      platform: "facebook",
      caption: [hook, body || cap, "", `— ${brand}`].filter(Boolean).join("\n\n").slice(0, FB_MAX),
      hashtags: hashtagStr(ce, "#SmallBusiness #Community").slice(0, 1000),
      imagePrompt: `${visual} — approachable Page image, no small legal text in artwork`,
      aspectRatio: "1:1 or 4:5",
      aspectRatioLabel: "Facebook Page",
      previewHint: "From Viral Content: hook + body.",
    },
    tiktok: {
      platform: "tiktok",
      caption: [shortV || hook, ce.hooks?.[0] ? `Hook: ${str(ce.hooks[0], 200)}` : "", "Sound on — short form."].filter(Boolean).join("\n\n").slice(0, TIKTOK_MAX),
      hashtags: "#POV #FYP",
      imagePrompt: `${visual} — vertical 9:16 key art, high energy, no wall of text`,
      aspectRatio: "9:16",
      aspectRatioLabel: "TikTok (vertical)",
      previewHint: "From Viral Content — in-app direct publish not wired; export or use TikTok app.",
    },
  };
  return [base.linkedin, base.instagram, base.facebook, base.tiktok];
}

/**
 * When viral content is present, merge it into the template list (same platforms).
 * Otherwise returns template-only variants.
 */
export function buildPlatformCaptionVariantsMerged(args: {
  topic: string;
  businessName?: string;
  contentEngine?: ContentEngineOutput | null;
}): PlatformCaptionVariant[] {
  if (args.contentEngine) {
    return buildPlatformCaptionVariantsFromViralContent({
      topic: args.topic,
      businessName: args.businessName,
      contentEngine: args.contentEngine,
    });
  }
  return buildPlatformCaptionVariants({ topic: args.topic, businessName: args.businessName });
}

/** Map Generate Viral Content output to the native SVG card lines (Bentley / Social Studio). */
export function buildNativeImageSpecFromViralContent(
  ce: ContentEngineOutput,
  args: { businessName?: string; topicFallback: string }
): NativeSocialImageSpec {
  const title = str(ce.captions?.hook, 80) || str(ce.fullPost?.caption, 80) || str(args.topicFallback, 80);
  const subtitle = str(ce.captions?.authority, 120) || str(ce.fullPost?.caption, 120) || str(args.businessName, 80);
  const line3 = str(ce.fullPost?.visualPrompt, 100) || str(ce.imagePrompts?.[0], 100) || "AI Revenue OS · Social Studio";
  return {
    title,
    subtitle: subtitle || args.businessName,
    line3,
    width: 1200,
    height: 630,
    accent: "#00D1FF",
    background: "#0b1224",
  };
}
