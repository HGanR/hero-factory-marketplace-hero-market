import { describe, it, expect } from "@jest/globals";
import {
  generateExternalSocialReviewTokenRaw,
  hashExternalSocialReviewTokenRaw,
  timingSafeEqualTokenHash,
} from "@/lib/social/external-social-review-token";

describe("external-social-review-token", () => {
  it("hash roundtrip verifies with timingSafeEqualTokenHash", () => {
    const raw = generateExternalSocialReviewTokenRaw();
    const h = hashExternalSocialReviewTokenRaw(raw);
    expect(timingSafeEqualTokenHash(raw, h)).toBe(true);
    expect(timingSafeEqualTokenHash(raw + "x", h)).toBe(false);
  });
});
