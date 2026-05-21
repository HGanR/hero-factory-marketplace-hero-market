import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareDraftVersions } from "@/lib/fulfillment/revision-delta-summary";

describe("revision-delta-summary", () => {
  it("detects substantive rewrite between versions", () => {
    const delta = compareDraftVersions({
      previousBody: "Short draft with contact form only.",
      currentBody:
        "Hero with Book now CTA. Reviews and testimonials. Local service area map. Call for free quote.",
      currentVersion: 2,
      previousVersion: 1,
    });
    assert.equal(delta.hasComparison, true);
    assert.ok(delta.improvements.length > 0);
  });
});
