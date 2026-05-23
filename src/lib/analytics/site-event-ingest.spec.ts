import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import {
  buildSiteAnalyticsInsertPayload,
  parseSiteEventBody,
  SiteEventBodySchema,
} from "@/lib/analytics/site-event-ingest";

const validBase = {
  sessionId: "sess-aaaaaaaa",
  visitorId: "vis-bbbbbbbb",
  path: "/",
  eventType: "button_click" as const,
};

describe("site-event-ingest", () => {
  it("accepts a valid site event payload with optional fields omitted", () => {
    const parsed = parseSiteEventBody({
      ...validBase,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.body.referrer, undefined);
    assert.equal(parsed.body.metadata, undefined);
  });

  it("rejects malformed payloads (Zod)", () => {
    const bad = parseSiteEventBody({ sessionId: "ab", visitorId: "short", path: "/", eventType: "button_click" });
    assert.equal(bad.ok, false);
  });

  it("rejects unknown eventType", () => {
    const bad = parseSiteEventBody({
      ...validBase,
      eventType: "not_a_real_type",
    });
    assert.equal(bad.ok, false);
  });

  it("preserves attribution-derived source/medium/campaign from UTM metadata on body", () => {
    const body = SiteEventBodySchema.parse({
      ...validBase,
      utmSource: "NewsLetter",
      utmMedium: "EMAIL",
      utmCampaign: "Spring-26",
      referrer: null,
      userAgent: null,
    });
    const row = buildSiteAnalyticsInsertPayload(body, "evt-1");
    assert.equal(row.source, "newsletter");
    assert.equal(row.medium, "email");
    assert.equal(row.campaign, "Spring-26");
  });

  it("preserves referral-style attribution when UTM absent but referrer is facebook", () => {
    const body = SiteEventBodySchema.parse({
      ...validBase,
      referrer: "https://www.facebook.com/groups/example",
    });
    const row = buildSiteAnalyticsInsertPayload(body, "evt-2");
    assert.equal(row.source, "facebook");
    assert.equal(row.medium, "referral");
  });

  it("does not require metadata keys beyond schema (optional metadata)", () => {
    const body = SiteEventBodySchema.parse({
      ...validBase,
      metadata: null,
    });
    const row = buildSiteAnalyticsInsertPayload(body, "evt-3");
    assert.equal(row.metadataJson, null);
  });

  it("serializes structured landing metadata without stripping stable eventName", () => {
    const body = SiteEventBodySchema.parse({
      ...validBase,
      eventType: "page_view",
      metadata: {
        eventName: LANDING_HOME_SITE_EVENTS.PAGE_VIEW,
        source: "landing_home",
        route: "/",
        label: "First paint",
      },
    });
    const row = buildSiteAnalyticsInsertPayload(body, "evt-4");
    assert.ok(row.metadataJson);
    const parsed = JSON.parse(row.metadataJson!) as { eventName: string };
    assert.equal(parsed.eventName, LANDING_HOME_SITE_EVENTS.PAGE_VIEW);
  });
});
