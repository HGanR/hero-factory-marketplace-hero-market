import type { SocialPlatform } from "@/lib/social/config";

export type StudioPlatform = "linkedin" | "instagram" | "facebook" | "tiktok";

export type PlatformCaptionVariant = {
  platform: StudioPlatform;
  caption: string;
  hashtags: string;
  imagePrompt: string;
  /** Short aspect guidance for previews */
  aspectRatio: string;
  aspectRatioLabel: string;
  previewHint: string;
};

const TIKTOK_MAX = 2200;
const LI_MAX = 3000;
const IG_MAX = 2200;
const FB_MAX = 5000;

/**
 * Heuristic, template-based copy — avoids extra LLM round-trips for v1.
 * Operators can edit in the governed composer after promotion to `campaign_posts`.
 */
export function buildPlatformCaptionVariants(args: { topic: string; businessName?: string }): PlatformCaptionVariant[] {
  const topic = args.topic.trim().slice(0, 200);
  const brand = (args.businessName ?? "Your brand").trim().slice(0, 80);
  const baseHook = topic ? `Why ${topic} matters for teams like yours —` : "A quick take worth saving —";
  return [
    {
      platform: "linkedin",
      caption: `${baseHook} here’s a concise perspective we’re sharing with our network. What would you add in the comments?\n\n— ${brand}`.slice(
        0,
        LI_MAX
      ),
      hashtags: "#Leadership #Growth #Business",
      imagePrompt: `Professional, editorial illustration about ${topic || "innovation"}, clean corporate palette, no text in image, wide format`,
      aspectRatio: "1.91:1 (share) or 1:1",
      aspectRatioLabel: "LinkedIn (landscape or square)",
      previewHint: "Article-style; lead with insight, invite discussion.",
    },
    {
      platform: "instagram",
      caption: `${topic ? `${topic} ✨\n\n` : ""}Saved this for the feed. Double-tap if you’d try this in your own workflow.\n\n— ${brand}`.slice(
        0,
        IG_MAX
      ),
      hashtags: "#Reels #Brand #Community",
      imagePrompt: `Bold, mobile-first product shot vibe for Instagram about ${
        topic || brand
      }, high contrast, no overlaid text`,
      aspectRatio: "4:5 feed / 9:16 story",
      aspectRatioLabel: "Instagram (4:5 or 9:16)",
      previewHint: "Visual-first; short hook + CTA in caption.",
    },
    {
      platform: "facebook",
      caption: `${baseHook} Sharing this with our Page audience — we’d love to hear what’s working in your org.\n\n— ${brand}`.slice(0, FB_MAX),
      hashtags: "#SmallBusiness #Community",
      imagePrompt: `Friendly, approachable Facebook Page creative about ${topic || brand}, people-forward, soft daylight, no text in image`,
      aspectRatio: "1:1 or 4:5",
      aspectRatioLabel: "Facebook Page",
      previewHint: "Community tone; can include link in composer.",
    },
    {
      platform: "tiktok",
      caption: `${topic ? `POV: ${topic}\n` : "POV: you finally fixed the workflow.\n"}Sound on — this is the short version.`.slice(0, TIKTOK_MAX),
      hashtags: "#POV #FYP",
      imagePrompt: `Vertical 9:16 key art for short-form about ${topic || brand}, energetic color blocks, no fine print text`,
      aspectRatio: "9:16",
      aspectRatioLabel: "TikTok (vertical)",
      previewHint: "TikTok in-app direct publish is not wired here — use export or native TikTok app.",
    },
  ];
}

export function studioPlatformsToSocialPlatforms(
  selected: StudioPlatform[]
): SocialPlatform[] {
  const out: SocialPlatform[] = [];
  for (const p of selected) {
    if (p === "linkedin") out.push("linkedin");
    if (p === "instagram") out.push("instagram");
    if (p === "facebook") out.push("facebook");
    if (p === "tiktok") out.push("tiktok");
  }
  return out;
}
