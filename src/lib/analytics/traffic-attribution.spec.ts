import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTrafficAttribution } from "@/lib/analytics/traffic-attribution";

describe("traffic-attribution", () => {
  it("prefers utm_source over referrer", () => {
    const a = resolveTrafficAttribution({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring",
      referrerUrl: "https://facebook.com/foo",
    });
    assert.equal(a.source, "newsletter");
    assert.equal(a.medium, "email");
    assert.equal(a.campaign, "spring");
  });

  it("detects facebook from referrer host", () => {
    const a = resolveTrafficAttribution({
      referrerUrl: "https://www.facebook.com/groups/abc",
    });
    assert.equal(a.source, "facebook");
    assert.equal(a.medium, "referral");
  });

  it("detects instagram from referrer", () => {
    const a = resolveTrafficAttribution({ referrerUrl: "https://instagram.com/reel/1" });
    assert.equal(a.source, "instagram");
  });

  it("uses direct when no signals", () => {
    const a = resolveTrafficAttribution({});
    assert.equal(a.source, "direct");
    assert.equal(a.medium, "none");
  });
});
