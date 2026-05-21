import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deliveryTokenPrefix,
  generateRawDeliveryToken,
  hashDeliveryToken,
  isDeliveryTokenFormat,
} from "@/lib/fulfillment/fulfillment-delivery-token";

describe("fulfillment-delivery-token", () => {
  it("generates hfd_ tokens with stable hash", () => {
    const raw = generateRawDeliveryToken();
    assert.ok(isDeliveryTokenFormat(raw));
    assert.equal(hashDeliveryToken(raw), hashDeliveryToken(`  ${raw}  `));
    assert.ok(deliveryTokenPrefix(raw).length > 0);
  });

  it("rejects invalid token format", () => {
    assert.equal(isDeliveryTokenFormat("bad"), false);
    assert.equal(isDeliveryTokenFormat("hfd_short"), false);
  });
});
