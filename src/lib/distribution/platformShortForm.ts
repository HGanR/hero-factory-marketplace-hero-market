/**
 * Phase 4J — Platform-specific short-form packs (TikTok, IG Reels, YouTube Shorts).
 * Pure formatting; no network calls.
 */

import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

export type ShortFormPlatformKey = "tiktok" | "instagram_reels" | "youtube_shorts";

export type ShortFormSlice = {
  label: string;
  hook: string;
  caption: string;
  cta: string;
  toneNote: string;
  hashtags: string[];
};

export type ShortFormPlatformPack = Record<ShortFormPlatformKey, ShortFormSlice>;

function firstLine(text: string): string {
  return text.split(/\n/).map((s) => s.trim()).find(Boolean) ?? "";
}

function tailCta(content: string, fallback: string): string {
  const lines = content.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const hit = [...lines].reverse().find((l) => /book|dm|call|link|apply|comment|save|subscribe/i.test(l));
  if (hit) return hit;
  const tail = lines.slice(-2).join("\n");
  return tail || fallback;
}

/**
 * Build three platform-specific text blocks from one Content Engine–shaped object.
 */
export function buildShortFormPlatformPack(
  output: Pick<ContentEngineOutput, "fullPost" | "captions" | "hooks">,
  businessName: string
): ShortFormPlatformPack {
  const hook =
    output.captions?.hook?.trim() ||
    output.hooks?.[0]?.trim() ||
    firstLine(output.fullPost?.caption ?? "") ||
    "Stop scrolling — this changes how you grow.";
  const captionBody = output.fullPost?.caption?.trim() || output.captions?.shortViral?.trim() || "";
  const body = output.fullPost?.content?.trim() || "";
  const baseCta = tailCta(body, "Comment “READY” if you want the next step.");
  const tags = (output.fullPost?.hashtags ?? []).slice(0, 8);

  const tiktok: ShortFormSlice = {
    label: "TikTok",
    hook: hook.slice(0, 120),
    caption: [
      captionBody.slice(0, 400),
      "",
      "⚡ On-screen: read the first line in the first 1s.",
      `Brand: ${businessName}`,
    ]
      .filter(Boolean)
      .join("\n"),
    cta: `Link in bio · ${baseCta.slice(0, 120)}`,
    toneNote: "Fast, conversational, pattern-interrupt; avoid long paragraphs on-screen.",
    hashtags: [...new Set([...tags, "#fyp", "#business"])].slice(0, 6),
  };

  const instagram_reels: ShortFormSlice = {
    label: "Instagram Reels",
    hook: hook.slice(0, 140),
    caption: [
      captionBody,
      "",
      "💾 Save this for your next content batch.",
      `— ${businessName}`,
    ]
      .filter(Boolean)
      .join("\n"),
    cta: `DM “${businessName.slice(0, 12) || "INFO"}” · ${baseCta.slice(0, 140)}`,
    toneNote: "Warm, authority-with-empathy; first line must work as cover text.",
    hashtags: [...new Set([...tags, "#reels", "#entrepreneur"])].slice(0, 12),
  };

  const youtube_shorts: ShortFormSlice = {
    label: "YouTube Shorts",
    hook: hook.slice(0, 100),
    caption: [
      `${hook.slice(0, 80)}`,
      "",
      captionBody.slice(0, 600),
      "",
      "Pinned comment: key takeaway + one next step.",
    ]
      .join("\n"),
    cta: `Subscribe for systems · ${baseCta.slice(0, 120)}`,
    toneNote: "Title energy in line 1; description skimmable; CTA softer than TikTok.",
    hashtags: [...new Set([...tags.slice(0, 4), "#Shorts"])].slice(0, 6),
  };

  return { tiktok, instagram_reels, youtube_shorts };
}
