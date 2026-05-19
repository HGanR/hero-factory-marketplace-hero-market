import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapPendingMarketplaceUserRowFull,
  mapPendingMarketplaceUserRowSafe,
  maskMarketplaceEmail,
  maskMarketplaceUsername,
} from "@/lib/executive-agent/pending-marketplace-users-preview-masking";

describe("pending marketplace users preview masking", () => {
  const sampleRow = {
    id: 42,
    email: "jane.doe@example.com",
    username: "janedoe",
    createdAt: new Date("2026-05-18T14:22:00.000Z"),
  };

  it("masks email and username without exposing raw values", () => {
    const safe = mapPendingMarketplaceUserRowSafe(sampleRow, 1);
    assert.equal(safe.displayIndex, 1);
    assert.equal(safe.createdAt, "2026-05-18T14:22:00.000Z");
    assert.equal("id" in safe, false);
    assert.equal("email" in safe, false);
    assert.equal("username" in safe, false);
    assert.ok(!safe.emailMasked.includes("jane.doe@example.com"));
    assert.ok(!safe.usernameMasked.includes("janedoe"));
    assert.match(safe.emailMasked, /^.+\*\*\*@.+\*\*\*\./);
    assert.match(safe.usernameMasked, /\*\*\*/);
  });

  it("preserves full rows for explicit admin opt-in", () => {
    const full = mapPendingMarketplaceUserRowFull(sampleRow);
    assert.deepEqual(full, {
      id: 42,
      email: "jane.doe@example.com",
      username: "janedoe",
      createdAt: "2026-05-18T14:22:00.000Z",
    });
  });

  it("redacts empty email and username", () => {
    assert.equal(maskMarketplaceEmail(""), "[redacted]");
    assert.equal(maskMarketplaceUsername(""), "[redacted]");
    const safe = mapPendingMarketplaceUserRowSafe(
      { id: 1, email: "", username: "", createdAt: "2026-05-18T14:22:00.000Z" },
      2,
    );
    assert.equal(safe.emailMasked, "[redacted]");
    assert.equal(safe.usernameMasked, "[redacted]");
  });
});
