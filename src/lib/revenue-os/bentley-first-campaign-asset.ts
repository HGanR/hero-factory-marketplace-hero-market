import type { SocialPlatform } from "@/lib/social/config";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { FocusLeverKey } from "@/lib/revenue-os/analysis-derivations";
import { computePrimaryFocusLever, firstPlanRecommendation } from "@/lib/revenue-os/analysis-derivations";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";

/** Prefer platforms aligned with lever when choosing a primary target (connected first). */
const LEVER_PLATFORM_PRIORITY: Record<FocusLeverKey, readonly SocialPlatform[]> = {
  traffic: ["tiktok", "instagram", "facebook", "linkedin", "pinterest", "snapchat"],
  conversionRatePct: ["facebook", "linkedin", "instagram", "tiktok", "pinterest", "snapchat"],
  avgOrderValue: ["instagram", "linkedin", "facebook", "tiktok", "pinterest", "snapchat"],
  cac: ["linkedin", "facebook", "instagram", "tiktok", "pinterest", "snapchat"],
};

function ceStr(value: unknown): string {
  return coerceTrimmedString(value);
}

/**
 * Pick one platform from posting intent: prefer connected + lever fit, else first matching lever order, else first in list.
 */
export function selectPrimaryPostingPlatform(
  postingPlatforms: SocialPlatform[],
  connectedPlatforms: ReadonlySet<SocialPlatform>,
  focus: FocusLeverKey
): SocialPlatform | null {
  if (postingPlatforms.length === 0) return null;
  const inList = new Set(postingPlatforms);
  const order = LEVER_PLATFORM_PRIORITY[focus];
  const connectedInList = postingPlatforms.filter((p) => connectedPlatforms.has(p));

  for (const pref of order) {
    if (inList.has(pref) && connectedInList.includes(pref)) return pref;
  }
  for (const pref of order) {
    if (inList.has(pref)) return pref;
  }
  return postingPlatforms[0];
}

export function focusKeyFromAnalysis(res: RevenueOsAnalyzeResponse): FocusLeverKey {
  return computePrimaryFocusLever(res).key;
}

function fallbackBody(
  res: RevenueOsAnalyzeResponse | null,
  form: RevenueOsDashboardFormValues
): string {
  const planLine = res ? firstPlanRecommendation(res) : null;
  const notes = coerceTrimmedString(form.notes);
  const core = coerceTrimmedString(form.coreOffer);
  const parts: string[] = [];
  if (planLine) parts.push(planLine);
  if (core) parts.push(`Offer: ${core}`);
  if (notes) parts.push(notes.slice(0, 1200));
  if (parts.length > 0) return parts.join("\n\n");
  return `${coerceTrimmedString(form.businessName)}: ${coerceTrimmedString(form.targetAudience).slice(0, 200)}`;
}

export type PlatformDraftParts = {
  /** Single field stored on campaign_posts.caption for publish adapters */
  captionForPublish: string;
  /** Optional hashtags string for API */
  hashtags?: string;
  /** Structured preview (editable blocks) */
  preview: { label: string; body: string }[];
};

/**
 * Map Content Engine output + analysis context into a platform-ready draft (no new LLM calls).
 */
export function buildFirstCampaignDraft(
  platform: SocialPlatform,
  ce: ContentEngineOutput | null,
  form: RevenueOsDashboardFormValues,
  res: RevenueOsAnalyzeResponse | null
): PlatformDraftParts {
  const hashtags =
    ce?.fullPost?.hashtags?.length
      ? ce.fullPost.hashtags
          .map((h) => {
            const tag = ceStr(h);
            return tag ? (tag.startsWith("#") ? tag : `#${tag}`) : "";
          })
          .filter(Boolean)
          .join(" ")
      : undefined;

  const img =
    ceStr(ce?.fullPost?.visualPrompt) ||
    ceStr(ce?.imagePrompts?.[0]) ||
    "";

  if (platform === "linkedin") {
    const postText =
      ceStr(ce?.fullPost?.caption) ||
      ceStr(ce?.captions?.authority) ||
      ceStr(ce?.captions?.hook) ||
      fallbackBody(res, form);
    const preview: { label: string; body: string }[] = [{ label: "Post text", body: postText }];
    if (img) preview.push({ label: "Image / creative brief", body: img });
    const captionForPublish = img ? `${postText}\n\n— Image / creative brief —\n${img}` : postText;
    return { captionForPublish, hashtags, preview };
  }

  if (platform === "instagram" || platform === "facebook") {
    const cap =
      ceStr(ce?.fullPost?.caption) ||
      ceStr(ce?.captions?.shortViral) ||
      ceStr(ce?.captions?.hook) ||
      fallbackBody(res, form);
    const preview: { label: string; body: string }[] = [{ label: "Caption", body: cap }];
    if (img) preview.push({ label: "Image prompt", body: img });
    const captionForPublish = img ? `${cap}\n\n— Visual —\n${img}` : cap;
    return { captionForPublish, hashtags, preview };
  }

  if (platform === "tiktok") {
    const hook =
      ceStr(ce?.hooks?.[0]) ||
      ceStr(ce?.captions?.hook) ||
      ceStr(ce?.captions?.shortViral) ||
      "";
    const script =
      ceStr(ce?.fullPost?.content) ||
      ceStr(ce?.captions?.curiosity) ||
      ceStr(ce?.fullPost?.caption) ||
      fallbackBody(res, form);
    const visual = img || `${ceStr(form.imageStyle) || "cinematic"} style — ${ceStr(form.contentTypeFocus) || "Full Post"}`;
    const preview: { label: string; body: string }[] = [
      { label: "Hook", body: hook || script.slice(0, 160) },
      { label: "Short script / body", body: script },
      { label: "Visual prompt", body: visual },
    ];
    const captionForPublish = [
      hook ? `[HOOK]\n${hook}` : `[HOOK]\n${script.slice(0, 200)}`,
      "",
      "[SCRIPT]",
      script,
      "",
      "[VISUAL]",
      visual,
    ].join("\n");
    return { captionForPublish, hashtags, preview };
  }

  /* pinterest, snapchat — treat like short caption + visual */
  const cap =
    ceStr(ce?.fullPost?.caption) ||
    ceStr(ce?.captions?.shortViral) ||
    fallbackBody(res, form);
  const preview: { label: string; body: string }[] = [{ label: "Caption", body: cap }];
  if (img) preview.push({ label: "Visual prompt", body: img });
  const captionForPublish = img ? `${cap}\n\n— Visual —\n${img}` : cap;
  return { captionForPublish, hashtags, preview };
}
