/**
 * Maps unified generation-style payloads into per-platform JSON for connectors.
 * Never throws — trims with warnings instead.
 */

import type { SocialPlatform } from "@/lib/social/config";

export type UnifiedContentPayload = {
  title?: string;
  caption?: string;
  body?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
  assetRefs?: string[];
  targetFormat?: string;
};

export type TransformedPlatformPayload = {
  payloadJson: Record<string, unknown>;
  warnings: string[];
};

function joinCaptionBody(u: UnifiedContentPayload): string {
  const c = (u.caption ?? "").trim();
  const b = (u.body ?? "").trim();
  if (c && b) return `${c}\n\n${b}`;
  return c || b;
}

function trimStr(s: string, max: number, label: string, warnings: string[]): string {
  if (s.length <= max) return s;
  warnings.push(`${label} trimmed from ${s.length} to ${max} characters.`);
  return s.slice(0, max).trimEnd();
}

function normalizeHashtags(tags: string[] | undefined, max: number, warnings: string[]): string[] {
  if (!tags?.length) return [];
  const flat = tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).slice(0, max);
  if (tags.length > max) warnings.push(`Hashtag list truncated to ${max} tags.`);
  return flat;
}

export function transformInstagramPayload(u: UnifiedContentPayload): TransformedPlatformPayload {
  const warnings: string[] = [];
  const caption = trimStr(joinCaptionBody(u), 2200, "Caption", warnings);
  const hashtags = normalizeHashtags(u.hashtags, 30, warnings);
  const cta = u.cta ? trimStr(u.cta, 400, "CTA", warnings) : "";
  const payloadJson: Record<string, unknown> = {
    platform: "instagram",
    caption,
    hashtags,
    cta,
    title: u.title ? trimStr(u.title, 200, "Title", warnings) : undefined,
    mediaPrompt: u.mediaPrompt,
    assetRefs: u.assetRefs,
    targetFormat: u.targetFormat ?? "feed",
  };
  return { payloadJson, warnings };
}

export function transformFacebookPayload(u: UnifiedContentPayload): TransformedPlatformPayload {
  const warnings: string[] = [];
  const body = trimStr(joinCaptionBody(u), 5000, "Body", warnings);
  const hashtags = normalizeHashtags(u.hashtags, 30, warnings);
  const payloadJson: Record<string, unknown> = {
    platform: "facebook",
    message: body,
    hashtags,
    cta: u.cta ? trimStr(u.cta, 500, "CTA", warnings) : undefined,
    title: u.title ? trimStr(u.title, 200, "Title", warnings) : undefined,
    mediaPrompt: u.mediaPrompt,
    assetRefs: u.assetRefs,
    targetFormat: u.targetFormat ?? "feed",
  };
  return { payloadJson, warnings };
}

export function transformTikTokPayload(u: UnifiedContentPayload): TransformedPlatformPayload {
  const warnings: string[] = [];
  const caption = trimStr(joinCaptionBody(u), 2200, "Caption", warnings);
  const hashtags = normalizeHashtags(u.hashtags, 25, warnings);
  if (u.targetFormat && !["short", "feed", "reel"].includes(String(u.targetFormat).toLowerCase())) {
    warnings.push("TikTok favors short vertical video — long-form narrative may need editing.");
  }
  const payloadJson: Record<string, unknown> = {
    platform: "tiktok",
    caption,
    hashtags,
    cta: u.cta ? trimStr(u.cta, 300, "CTA", warnings) : undefined,
    mediaPrompt: u.mediaPrompt,
    assetRefs: u.assetRefs,
    targetFormat: u.targetFormat ?? "short",
  };
  return { payloadJson, warnings };
}

export function transformLinkedInPayload(u: UnifiedContentPayload): TransformedPlatformPayload {
  const warnings: string[] = [];
  const text = trimStr(joinCaptionBody(u), 3000, "Post body", warnings);
  const hashtags = normalizeHashtags(u.hashtags, 15, warnings);
  const payloadJson: Record<string, unknown> = {
    platform: "linkedin",
    text,
    hashtags,
    title: u.title ? trimStr(u.title, 200, "Title", warnings) : undefined,
    cta: u.cta ? trimStr(u.cta, 400, "CTA", warnings) : undefined,
    mediaPrompt: u.mediaPrompt,
    assetRefs: u.assetRefs,
    targetFormat: u.targetFormat ?? "feed",
  };
  return { payloadJson, warnings };
}

export function transformYouTubePayload(u: UnifiedContentPayload): TransformedPlatformPayload {
  const warnings: string[] = [];
  const title = trimStr(u.title ?? joinCaptionBody(u).slice(0, 80), 100, "Title", warnings);
  const description = trimStr(
    [joinCaptionBody(u), u.cta ? `CTA: ${u.cta}` : "", u.hashtags?.join(" ")]
      .filter(Boolean)
      .join("\n\n"),
    5000,
    "Description",
    warnings
  );
  const hashtags = normalizeHashtags(u.hashtags, 15, warnings);
  const payloadJson: Record<string, unknown> = {
    platform: "youtube",
    title,
    description,
    tags: hashtags.map((h) => h.replace(/^#/, "")),
    mediaPrompt: u.mediaPrompt,
    assetRefs: u.assetRefs,
    targetFormat: u.targetFormat ?? "short",
  };
  return { payloadJson, warnings };
}

export function transformPayloadForPlatform(
  platform: SocialPlatform | "youtube",
  u: UnifiedContentPayload
): TransformedPlatformPayload {
  switch (platform) {
    case "instagram":
      return transformInstagramPayload(u);
    case "facebook":
      return transformFacebookPayload(u);
    case "tiktok":
      return transformTikTokPayload(u);
    case "linkedin":
      return transformLinkedInPayload(u);
    case "youtube":
      return transformYouTubePayload(u);
    default:
      return transformFacebookPayload({ ...u, body: joinCaptionBody(u) || `[${platform}] ${u.title ?? ""}` });
  }
}
