import { describe, it, expect } from "@jest/globals";
import {
  isAutomatedOAuthPublishSupported,
  socialAccountTokenLikelyExpired,
  userFacingMessageForPublishApiFailure,
} from "@/lib/social/campaign-launch-publish-ui";

describe("campaign-launch-publish-ui", () => {
  it("isAutomatedOAuthPublishSupported is true only for adapter-backed platforms", () => {
    expect(isAutomatedOAuthPublishSupported("linkedin")).toBe(true);
    expect(isAutomatedOAuthPublishSupported("instagram")).toBe(true);
    expect(isAutomatedOAuthPublishSupported("facebook")).toBe(true);
    expect(isAutomatedOAuthPublishSupported("tiktok")).toBe(false);
    expect(isAutomatedOAuthPublishSupported(null)).toBe(false);
  });

  it("socialAccountTokenLikelyExpired respects expiresAt", () => {
    expect(socialAccountTokenLikelyExpired(null)).toBe(false);
    expect(socialAccountTokenLikelyExpired("")).toBe(false);
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(socialAccountTokenLikelyExpired(past)).toBe(true);
    expect(socialAccountTokenLikelyExpired(future)).toBe(false);
  });

  it("userFacingMessageForPublishApiFailure maps status and codes", () => {
    expect(
      userFacingMessageForPublishApiFailure(409, { error: "IN_PROGRESS" }, "linkedin")
    ).toMatch(/in progress/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { error: "ALREADY_POSTED" }, null)
    ).toMatch(/already published/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { error: "INVALID_STATUS" }, null)
    ).toMatch(/current status/i);
    expect(userFacingMessageForPublishApiFailure(401, {}, "instagram")).toMatch(/sign in/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { code: "ACCOUNT_NOT_CONNECTED" }, "linkedin")
    ).toMatch(/Connect/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { code: "PLATFORM_UNSUPPORTED" }, "tiktok")
    ).toMatch(/not available/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { code: "INVALID_PLATFORM" }, null)
    ).toMatch(/not recognized/i);
    expect(
      userFacingMessageForPublishApiFailure(502, { error: "PUBLISH_FAILED", message: "" }, null)
    ).toMatch(/publish service|reconnect/i);
    expect(
      userFacingMessageForPublishApiFailure(400, { message: "Custom server text" }, null)
    ).toBe("Custom server text");
  });
});
