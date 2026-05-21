import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreDraftQuality } from "@/lib/fulfillment/fulfillment-quality-score";
import type { WebsiteIntakeNormalized } from "@/lib/fulfillment/website-intake-types";

const profile: WebsiteIntakeNormalized = {
  businessName: "Bella Bistro",
  businessType: "restaurant",
  industry: "food",
  niche: null,
  targetAudience: "local diners",
  desiredPages: [],
  websiteGoals: ["reservations"],
  colorPreferences: [],
  stylePreferences: [],
  primaryCTA: "Reserve a table",
  contactInfo: { phone: "555-0200" },
  socialLinks: [],
  bookingNeeded: true,
  ecommerceNeeded: false,
  trustSignals: [],
  referenceSites: [],
  launchUrgency: null,
};

describe("fulfillment-quality-score", () => {
  it("scores draft with CTA and trust language higher", () => {
    const result = scoreDraftQuality({
      normalized: profile,
      readiness: {
        tier: "strong",
        score: 80,
        fulfillmentReady: true,
        missingFields: [],
        presentFields: [],
      },
      draftNoteText:
        "[Site Builder — approved task]\nTitle: Bella\nPriority: normal\n\nHero with Reserve a table CTA. Menu highlights and reviews. Call to book.",
      draftVersion: 1,
    });
    assert.ok(result.draftQualityScore >= 50);
    assert.ok(["low", "medium", "high"].includes(result.conversionReadiness));
    assert.ok(result.conversionChecklist.some((c) => c.id === "hero_cta"));
  });
});
