import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSiteBuilderTaskPayloadFromOrder } from "@/lib/fulfillment/fulfillment-site-builder-payload";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

describe("buildSiteBuilderTaskPayloadFromOrder", () => {
  it("builds payload from order sales summary and deliverable json", () => {
    const payload = buildSiteBuilderTaskPayloadFromOrder({
      clientId: CLIENT_ID,
      salesSummaryText: "Client paid for starter website.",
      requestedDeliverableJson: JSON.stringify({
        type: "site_builder_package",
        title: "Starter site",
        notes: "Include contact form",
      }),
    });
    assert.equal(payload.clientId, CLIENT_ID);
    assert.equal(payload.title, "Starter site");
    assert.ok(payload.instruction.includes("starter website"));
    assert.ok(payload.instruction.includes("Structured Site Builder brief"));
    assert.ok(payload.instruction.includes("No deploy"));
  });

  it("applies optional overrides", () => {
    const payload = buildSiteBuilderTaskPayloadFromOrder(
      {
        clientId: CLIENT_ID,
        salesSummaryText: "x",
        requestedDeliverableJson: null,
      },
      { title: "Custom", instruction: "Do the draft.", priority: "high" }
    );
    assert.equal(payload.title, "Custom");
    assert.equal(payload.instruction, "Do the draft.");
    assert.equal(payload.priority, "high");
  });
});
