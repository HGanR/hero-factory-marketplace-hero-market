import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicClientProviderConnection } from "@/lib/revenue-os/content360-public";
import type { ClientProviderConnectionRow } from "@/lib/db/schema";

describe("content360-public DTO", () => {
  it("toPublicClientProviderConnection omits encrypted credential columns", () => {
    const row = {
      id: "id-1",
      userId: "99",
      clientId: "00000000-0000-4000-8000-000000000001",
      provider: "content360",
      accountName: "Acme",
      externalAccountId: "ext-1",
      accessTokenEnc: "ENCRYPTED_SECRET",
      refreshTokenEnc: "REFRESH_SECRET",
      connectionStatus: "active",
      lastVerifiedAt: null,
      metadataJson: { a: 1 },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as ClientProviderConnectionRow;

    const pub = toPublicClientProviderConnection(row);
    const json = JSON.stringify(pub);
    assert.equal(json.includes("ENCRYPTED_SECRET"), false);
    assert.equal(json.includes("REFRESH_SECRET"), false);
    assert.equal(pub.accountName, "Acme");
  });
});
