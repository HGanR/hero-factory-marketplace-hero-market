import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStructuredSiteBuilderBrief } from "@/lib/fulfillment/site-builder-brief-builder";
import type { WebsiteIntakeNormalized } from "@/lib/fulfillment/website-intake-types";

const profile: WebsiteIntakeNormalized = {
  businessName: "Acme Plumbing",
  businessType: "local plumber",
  industry: "home services",
  niche: null,
  targetAudience: "homeowners",
  desiredPages: ["Services", "Contact"],
  websiteGoals: ["get more calls"],
  colorPreferences: [],
  stylePreferences: [],
  primaryCTA: "Call now",
  contactInfo: { phone: "555-0100" },
  socialLinks: [],
  bookingNeeded: true,
  ecommerceNeeded: false,
  trustSignals: ["Licensed"],
  referenceSites: [],
  launchUrgency: "normal",
};

describe("site-builder-brief-builder", () => {
  it("builds structured brief with section plan and guardrails", () => {
    const brief = buildStructuredSiteBuilderBrief({
      normalized: profile,
      readiness: {
        tier: "medium",
        score: 65,
        fulfillmentReady: true,
        missingFields: [],
        presentFields: ["businessName"],
      },
    });
    assert.ok(brief.includes("Structured Site Builder brief"));
    assert.ok(brief.includes("Section plan"));
    assert.ok(brief.includes("Hero & primary CTA"));
    assert.ok(brief.includes("No deploy"));
  });
});
