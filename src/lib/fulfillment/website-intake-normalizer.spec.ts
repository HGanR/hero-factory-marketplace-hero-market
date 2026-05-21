import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeWebsiteIntake } from "@/lib/fulfillment/website-intake-normalizer";
import { buildWebsiteIntakePackage } from "@/lib/fulfillment/website-intake-summary";

describe("website intake normalizer", () => {
  it("merges structured websiteIntake with sales text extraction", () => {
    const profile = normalizeWebsiteIntake({
      websiteIntake: {
        businessName: "Bright Dental",
        industry: "Healthcare",
        primaryCTA: "Book cleaning",
      },
      salesSummaryText:
        "Target audience: families in Austin. Pages: home, services, contact. Email: desk@bright.test",
    });
    assert.equal(profile.businessName, "Bright Dental");
    assert.equal(profile.industry, "Healthcare");
    assert.equal(profile.primaryCTA, "Book cleaning");
    assert.ok(profile.targetAudience?.includes("families"));
    assert.ok(profile.desiredPages.length >= 1);
    assert.equal(profile.contactInfo?.email, "desk@bright.test");
  });

  it("builds skipper summary with readiness tier", () => {
    const pkg = buildWebsiteIntakePackage({
      websiteIntake: {
        businessName: "Studio X",
        websiteGoals: ["Show portfolio"],
        contactInfo: { phone: "555-0199" },
      },
      salesSummaryText: "Client wants a modern site.",
    });
    assert.ok(pkg.skipperSummary.includes("Studio X"));
    assert.ok(pkg.readiness.score >= 0);
    assert.match(pkg.skipperSummary, /WEAK|MEDIUM|STRONG/i);
  });
});
