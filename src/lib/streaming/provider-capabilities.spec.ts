/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { getProviderCapabilities, providerCapabilitiesSnapshot, PROVIDER_CAPABILITIES } from "./provider-capabilities";

describe("provider-capabilities", () => {
  it("maps twitch to stable ingest without manual go-live", () => {
    const c = getProviderCapabilities("twitch");
    expect(c.platform).toBe("twitch");
    expect(c.isStableIngest).toBe(true);
    expect(c.requiresManualGoLive).toBe(false);
    expect(c.supportsPortrait).toBe(false);
    expect(PROVIDER_CAPABILITIES.twitch.isStableIngest).toBe(true);
  });

  it("maps instagram to best effort with manual go-live and portrait", () => {
    const c = getProviderCapabilities("instagram");
    expect(c.isStableIngest).toBe(false);
    expect(c.requiresManualGoLive).toBe(true);
    expect(c.supportsPortrait).toBe(true);
    expect(c.resolverWarningLines.length).toBeGreaterThan(0);
  });

  it("normalizes unknown platform to custom", () => {
    const c = getProviderCapabilities("unknown-platform");
    expect(c.platform).toBe("custom");
    expect(c.resolverWarningLines.length).toBeGreaterThan(0);
  });

  it("providerCapabilitiesSnapshot aggregates stable tiers", () => {
    const s = providerCapabilitiesSnapshot(["twitch", "tiktok", "twitch"]);
    expect(s).toContain("twitch:stable");
    expect(s).toContain("tiktok:best_effort");
  });
});
