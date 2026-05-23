import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANDING_HOME_SITE_EVENTS, landingCtaMetadata } from "@/lib/analytics/landing-site-event-metadata";

describe("landing-site-event-metadata", () => {
  it("emits stable string keys including targetHref when provided", () => {
    const m = landingCtaMetadata({
      eventName: LANDING_HOME_SITE_EVENTS.FOOTER_CTA,
      source: "footer",
      route: "/",
      label: "Consultations",
      targetHref: "/consultations",
    });
    assert.equal(m.eventName, "landing_home.footer.cta");
    assert.equal(m.source, "footer");
    assert.equal(m.route, "/");
    assert.equal(m.label, "Consultations");
    assert.equal(m.targetHref, "/consultations");
  });

  it("omits targetHref when absent or empty", () => {
    const a = landingCtaMetadata({
      eventName: LANDING_HOME_SITE_EVENTS.REALITY_WIDGET_OPEN,
      source: "landing_reality_widget",
      route: "/",
      label: "Open REALITY",
    });
    assert.equal("targetHref" in a, false);

    const b = landingCtaMetadata({
      eventName: LANDING_HOME_SITE_EVENTS.REALITY_WIDGET_OPEN,
      source: "x",
      route: "/",
      label: "y",
      targetHref: "   ",
    });
    assert.equal("targetHref" in b, false);
  });

  it("keeps canonical landing_home.* eventName literals stable", () => {
    assert.equal(LANDING_HOME_SITE_EVENTS.PAGE_VIEW, "landing_home.page_view");
    assert.equal(LANDING_HOME_SITE_EVENTS.DEMOS_INDUSTRY_CTA, "landing_home.demos.industry_cta");
    assert.equal(LANDING_HOME_SITE_EVENTS.WELCOME_MENU_CTA, "landing_home.welcome.menu_cta");
    assert.equal(LANDING_HOME_SITE_EVENTS.REALITY_PAYPAL_OUTBOUND, "landing_home.reality.paypal_outbound");
    assert.equal(LANDING_HOME_SITE_EVENTS.SCROLL_WORLDS_LINK, "landing_home.scroll.worlds_link");
  });
});
