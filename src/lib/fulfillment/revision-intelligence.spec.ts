import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectRevisionNotesFromEvents,
  extractRevisionIntent,
} from "@/lib/fulfillment/revision-intelligence";

describe("revision-intelligence", () => {
  it("extracts themes from revision note", () => {
    const intent = extractRevisionIntent([
      "Please strengthen the hero CTA and add more trust badges on mobile.",
    ]);
    assert.ok(intent.themes.includes("hero_section") || intent.themes.includes("cta_conversion"));
    assert.ok(intent.summary.length > 10);
  });

  it("collects revision notes from order events", () => {
    const notes = collectRevisionNotesFromEvents([
      {
        payloadJson: JSON.stringify({
          action: "deliverable_revision_requested",
          revisionNote: "Update menu section",
        }),
      },
      { payloadJson: JSON.stringify({ action: "payment_confirmed" }) },
    ]);
    assert.equal(notes.length, 1);
    assert.match(notes[0]!, /menu/i);
  });
});
