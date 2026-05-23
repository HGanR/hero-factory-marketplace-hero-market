/**
 * Stable `metadata` keys for `POST /api/analytics/site-event` from the public landing home.
 * Do not rename `LANDING_HOME_SITE_EVENTS` values without updating executive rollups / tests.
 */

export const LANDING_HOME_SITE_EVENTS = {
  PAGE_VIEW: "landing_home.page_view",
  /** DEMOS dropdown — industry vertical entry */
  DEMOS_INDUSTRY_CTA: "landing_home.demos.industry_cta",
  WELCOME_MENU_CTA: "landing_home.welcome.menu_cta",
  WELCOME_JOIN_COMMUNITY_CLICK: "landing_home.welcome.join_community_click",
  WELCOME_PAYPAL_OUTBOUND: "landing_home.welcome.paypal_outbound",
  FOOTER_CTA: "landing_home.footer.cta",
  HERO_BRAND: "landing_home.nav.hero_brand",
  REVENUE_SECTION_CTA: "landing_home.revenue_section.cta",
  COMMUNITY_VIDEO_PLAY: "landing_home.community_video.play",
  COMMUNITY_VIDEO_DOWNLOAD: "landing_home.community_video.download",
  REALITY_WIDGET_OPEN: "landing_home.reality.widget_open",
  REALITY_JOIN_COMMUNITY_CLICK: "landing_home.reality.join_community_click",
  REALITY_PAYPAL_OUTBOUND: "landing_home.reality.paypal_outbound",
  REGISTER_CONTINUE_INTENT: "landing_home.register.continue_intent",
  SCROLL_MISSION_LINK: "landing_home.scroll.mission_link",
  SCROLL_VISION_LINK: "landing_home.scroll.vision_path_link",
  SCROLL_WORLDS_LINK: "landing_home.scroll.worlds_link",
} as const;

export type LandingCtaMetadataInput = {
  /** Must match `LANDING_HOME_SITE_EVENTS` entries for stable dashboards. */
  eventName: string;
  /** UI surface (e.g. welcome_menu, demos_menu, footer). */
  source: string;
  /** Pathname where the interaction occurred. */
  route: string;
  /** Short human-readable control label. */
  label: string;
  /** Link destination when applicable (same-origin path or absolute URL). */
  targetHref?: string | null;
};

/**
 * Normalized metadata object: every key is a string so payloads stay JSON-friendly and predictable.
 * Extra analytics dimensions can be merged after this helper.
 */
export function landingCtaMetadata(input: LandingCtaMetadataInput): Record<string, string> {
  const meta: Record<string, string> = {
    eventName: input.eventName,
    source: input.source,
    route: input.route,
    label: input.label,
  };
  const href = input.targetHref?.trim();
  if (href) meta.targetHref = href;
  return meta;
}
