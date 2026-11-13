import test from "node:test";
import assert from "node:assert/strict";
import { parseAirportPrice, AIRPORT_MODEL_URL, AIRPORT_EXPECTED_SHA256 } from "../scripts/publish-airport-asset";

test("airport publication requires explicit valid token price", () => {
  for (const value of [undefined, "", "-1", "1.5", "1e6", "Infinity", "2147483648"]) {
    assert.throws(() => parseAirportPrice(value));
  }
  assert.equal(parseAirportPrice("0"), 0);
  assert.equal(parseAirportPrice("25"), 25);
});

test("airport registration points to exact approved GLB, not older grass model", () => {
  assert.equal(AIRPORT_MODEL_URL, "/models/world-assets/airport_cycle_30min.glb");
  assert.equal(AIRPORT_EXPECTED_SHA256, "83ba5e7bb48658831e67f5259f570331465ff5a8bb22bbc1275817e9a8ad43aa");
});
