import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreWebsiteIntakeReadiness } from "@/lib/fulfillment/website-intake-readiness";
import type { WebsiteIntakeNormalized } from "@/lib/fulfillment/website-intake-types";

const BASE: WebsiteIntakeNormalized = {
  businessName: null,
  businessType: null,
  industry: null,
  niche: null,
  targetAudience: null,
  desiredPages: [],
  websiteGoals: [],
  colorPreferences: [],
  stylePreferences: [],
  primaryCTA: null,
  contactInfo: null,
  socialLinks: [],
  bookingNeeded: null,
  ecommerceNeeded: null,
  trustSignals: [],
  referenceSites: [],
  launchUrgency: null,
};

describe("website intake readiness", () => {
  it("marks sparse intake as weak and not fulfillment-ready", () => {
    const r = scoreWebsiteIntakeReadiness(BASE);
    assert.equal(r.tier, "weak");
    assert.equal(r.fulfillmentReady, false);
    assert.ok(r.missingFields.length > 0);
  });

  it("marks rich intake as strong and fulfillment-ready", () => {
    const r = scoreWebsiteIntakeReadiness({
      ...BASE,
      businessName: "Acme Coaching",
      industry: "Professional services",
      targetAudience: "Small business owners",
      desiredPages: ["Home", "About", "Services", "Contact"],
      websiteGoals: ["Generate leads", "Explain offer"],
      primaryCTA: "Book a discovery call",
      contactInfo: { email: "hello@acme.test", phone: "555-0100" },
      colorPreferences: ["navy", "gold"],
      launchUrgency: "high",
      bookingNeeded: true,
    });
    assert.equal(r.tier, "strong");
    assert.equal(r.fulfillmentReady, true);
    assert.ok(r.score >= 70);
  });
});
