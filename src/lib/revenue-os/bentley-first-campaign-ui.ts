import { readBentleySessionWithLegacyFallback } from "@/lib/revenue-os/bentley-storage-scope";

/** DOM id for scroll targets + anchor links to the first-campaign-asset card. */
export const BENTLEY_FIRST_CAMPAIGN_ASSET_ANCHOR = "bentley-first-campaign-asset";

/** Legacy base sessionStorage key (scoped via `bentley-storage-scope`). */
export const BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY = "revenue-os:first-campaign-draft";

/** Same-tab listeners refresh launch-readiness when a server draft id is saved. */
export const BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT = "bentley:first-campaign-draft-changed";

export type FirstCampaignDraftMeta = {
  campaignId: string;
  postId: string;
  platform: string;
};

export function readFirstCampaignDraftMeta(): FirstCampaignDraftMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readBentleySessionWithLegacyFallback(BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as FirstCampaignDraftMeta;
    if (j?.campaignId && j?.postId && j?.platform) return j;
    return null;
  } catch {
    return null;
  }
}

/**
 * Smooth-scroll to the first-campaign card, set the URL hash without a jump, then focus the caption field.
 */
export function scrollToFirstCampaignAssetCard(): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(BENTLEY_FIRST_CAMPAIGN_ASSET_ANCHOR);
  const url = new URL(window.location.href);
  url.hash = BENTLEY_FIRST_CAMPAIGN_ASSET_ANCHOR;
  window.history.replaceState(null, "", url.toString());
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusCaption = () => {
    const ta = el?.querySelector<HTMLTextAreaElement>("textarea[data-bentley-caption]");
    ta?.focus();
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(focusCaption);
  });
}
