import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDraftPreviewText,
  parseFulfillmentOrderIdFromPayload,
  parseSiteBuilderNoteFields,
} from "@/lib/fulfillment/fulfillment-deliverable-draft-parse";

describe("fulfillment deliverable draft", () => {
  it("parses fulfillmentOrderId from approval payload", () => {
    assert.equal(
      parseFulfillmentOrderIdFromPayload({
        clientId: "00000000-0000-4000-8000-000000000001",
        fulfillmentOrderId: "00000000-0000-4000-8000-000000000099",
        title: "Site",
        instruction: "Build",
      }),
      "00000000-0000-4000-8000-000000000099"
    );
  });

  it("parses Site Builder note title and body", () => {
    const fields = parseSiteBuilderNoteFields(
      "[Site Builder — approved task]\nTitle: Acme Home\nPriority: high\n\nBuild hero and contact.\n\n(No live site schema mutation from this action.)"
    );
    assert.equal(fields.title, "Acme Home");
    assert.equal(fields.priority, "high");
    assert.ok(fields.body.includes("Build hero"));
  });

  it("builds redacted preview text", () => {
    const preview = buildDraftPreviewText(
      "[Site Builder — approved task]\nTitle: T\nPriority: normal\n\nInstruction line."
    );
    assert.ok(preview.includes("Title: T"));
    assert.ok(preview.includes("Instruction line"));
  });
});
