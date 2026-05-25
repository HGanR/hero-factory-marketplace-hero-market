/**
 * Default creative briefs per platform when the model omits `platformPosts` prompts.
 * Keeps merge logic testable without the UI bundle.
 */

import type { BentleyPlatformPostKey } from "@/lib/revenue-os/campaign-schema";

export type BentleyPromptTemplateCtx = {
  industry: string;
  audience: string;
  offer: string;
};

function fill(s: string, ctx: BentleyPromptTemplateCtx): string {
  return s
    .replace(/\{\{INDUSTRY\}\}/g, ctx.industry)
    .replace(/\{\{AUDIENCE\}\}/g, ctx.audience)
    .replace(/\{\{OFFER\}\}/g, ctx.offer);
}

const TIKTOK_TEXT = `Create a 15–30 second short-form video.

Hook (first 3 seconds):
"Nobody tells you this about {{INDUSTRY}}…"

Scene Flow:
- Scene 1: Relatable problem for {{AUDIENCE}} (fast cut)
- Scene 2: Emotional tension
- Scene 3: Reveal solution (your offer: {{OFFER}})
- Scene 4: Social proof or result
- Scene 5: Call to action

Style:
- Fast cuts
- Captions on screen
- High contrast visuals

Tone:
Conversational, slightly provocative

CTA:
"Follow for more" or "Link in bio"`;

const TIKTOK_IMAGE = `Vertical 9:16 key art for TikTok: bold headline in the safe zone, one proof cue for {{AUDIENCE}}, high contrast, thumb-stopping first frame.`;

const TIKTOK_VIDEO = TIKTOK_TEXT;

const INSTAGRAM_TEXT = `Create a high-quality visual post for {{AUDIENCE}} in {{INDUSTRY}}.

Caption structure:
- Hook (first line must stop scroll)
- Value (educate or inspire) — land on: {{OFFER}}
- CTA (DM / Link in bio)

Tone:
Professional but human

Goal:
Saveable + shareable content`;

const INSTAGRAM_IMAGE = `Single Instagram-native image: clean, modern design; brand-forward; minimal text overlay; hero moment that supports: {{OFFER}} for {{AUDIENCE}}.`;

const INSTAGRAM_VIDEO = `Optional Reel (15–45s): one clear transformation story for {{AUDIENCE}}; show proof; end with CTA tied to {{OFFER}}.`;

const FACEBOOK_TEXT = `Create a social post focused on clarity and trust for {{AUDIENCE}}.

Structure:
- Problem statement ({{INDUSTRY}})
- Simple explanation
- Solution: {{OFFER}}
- CTA ("Learn more", "Message us", or "Book now")

Tone:
Approachable, slightly formal`;

const FACEBOOK_IMAGE = `Facebook feed image: trustworthy, readable at small size; headline + one supporting line about {{OFFER}}; avoid clutter.`;

const FACEBOOK_VIDEO = `Short explainer (30–90s): plain-language walkthrough of {{OFFER}} for {{AUDIENCE}}; calm pacing; clear CTA end card.`;

const REDDIT_TEXT = `Write a conversational post for Reddit aimed at {{AUDIENCE}} interested in {{INDUSTRY}}.

Rules:
- No direct selling
- Tell a story or share insight related to {{OFFER}} without a hard pitch
- Ask a question at the end

Tone:
Authentic, slightly vulnerable

Goal:
Engagement + discussion`;

const REDDIT_IMAGE = `If the sub allows media: one honest, non-promotional visual that supports the story (no salesy text overlays). Context: {{INDUSTRY}} / {{AUDIENCE}}.`;

const REDDIT_VIDEO = `Optional: short authentic clip (talking head or screen share) — educational or story-first; no aggressive CTA; invite discussion.`;

const NEXTDOOR_TEXT = `Create a community-focused post for neighbors ({{AUDIENCE}}).

Structure:
- Local relevance
- Helpful insight about {{INDUSTRY}}
- Offer value through {{OFFER}} without aggressive marketing

Tone:
Friendly, neighborly, trustworthy

Constraints:
- If you attach media, keep file size under 10MB
- Avoid aggressive marketing

Goal:
Trust + visibility in the local network`;

const NEXTDOOR_IMAGE = `Nextdoor-friendly image: local, practical, neighborly; soft branding only; supports message about {{OFFER}}.`;

const NEXTDOOR_VIDEO = `Short neighborly clip: calm tone, local context, helpful tip; mention {{OFFER}} only as helpful context, not a hard sell.`;

const DEFAULTS: Record<
  BentleyPlatformPostKey,
  { promptText: string; promptImage: string; promptVideo: string }
> = {
  tiktok: { promptText: TIKTOK_TEXT, promptImage: TIKTOK_IMAGE, promptVideo: TIKTOK_VIDEO },
  instagram: { promptText: INSTAGRAM_TEXT, promptImage: INSTAGRAM_IMAGE, promptVideo: INSTAGRAM_VIDEO },
  facebook: { promptText: FACEBOOK_TEXT, promptImage: FACEBOOK_IMAGE, promptVideo: FACEBOOK_VIDEO },
  reddit: { promptText: REDDIT_TEXT, promptImage: REDDIT_IMAGE, promptVideo: REDDIT_VIDEO },
  nextdoor: { promptText: NEXTDOOR_TEXT, promptImage: NEXTDOOR_IMAGE, promptVideo: NEXTDOOR_VIDEO },
};

export function buildBentleyPlatformPromptDefaults(
  platform: BentleyPlatformPostKey,
  ctx: BentleyPromptTemplateCtx
): { promptText: string; promptImage: string; promptVideo: string } {
  const d = DEFAULTS[platform];
  return {
    promptText: fill(d.promptText, ctx),
    promptImage: fill(d.promptImage, ctx),
    promptVideo: fill(d.promptVideo, ctx),
  };
}
