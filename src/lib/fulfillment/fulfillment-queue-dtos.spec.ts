import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSalesSummaryExcerpt,
  isFulfillmentQueueApprovalFilter,
  maskPaymentExternalRef,
} from "@/lib/fulfillment/fulfillment-queue-dtos";

describe("fulfillment queue DTO helpers", () => {
  it("masks payment external refs", () => {
    assert.equal(maskPaymentExternalRef("PAYPAL-TXN-ABCDEF12"), "***EF12");
    assert.equal(maskPaymentExternalRef(null), null);
  });

  it("redacts and truncates sales summary excerpts", () => {
    const long = "a".repeat(300);
    const excerpt = buildSalesSummaryExcerpt(long);
    assert.ok(excerpt);
    assert.ok(excerpt!.length <= 240);
    const secret = buildSalesSummaryExcerpt("api_key=supersecret12345");
    assert.ok(secret?.includes("[redacted]"));
  });

  it("recognizes approval filters", () => {
    assert.ok(isFulfillmentQueueApprovalFilter("pending"));
    assert.equal(isFulfillmentQueueApprovalFilter("bogus"), false);
  });
});
