import { resolveSocialStudioPromoteReadiness } from "@/lib/revenue-os/social-studio-promote-readiness";
import type { SocialAccountRow } from "@/lib/db/schema";

function acc(p: string, id = "a1"): SocialAccountRow {
  return {
    id,
    userId: "1",
    clientId: "",
    platform: p,
    authType: "OAUTH",
    accessTokenEnc: null,
    refreshTokenEnc: null,
    expiresAt: null,
    externalAccountId: "x",
    scopes: null,
    displayName: "Test",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("resolveSocialStudioPromoteReadiness", () => {
  it("marks tiktok as manual-only (no direct publish)", () => {
    const r = resolveSocialStudioPromoteReadiness({
      targetPlatform: "tiktok",
      socialAccount: acc("tiktok"),
      postMode: "publish_now",
      scheduledAtIso: null,
      campaignAssetId: "c1",
      assetCreativeType: "IMAGE",
      hasHostedHttpsAssetUrl: true,
      treatAsHasStorageUrlForValidation: true,
    });
    expect(r.manualOnlyPlatform).toBe(true);
    expect(r.publishNowReady).toBe(false);
  });

  it("requires hosted URL for scheduled Instagram with media rules", () => {
    const r = resolveSocialStudioPromoteReadiness({
      targetPlatform: "instagram",
      socialAccount: acc("instagram"),
      postMode: "schedule",
      scheduledAtIso: new Date().toISOString(),
      campaignAssetId: "c1",
      assetCreativeType: "IMAGE",
      hasHostedHttpsAssetUrl: false,
      treatAsHasStorageUrlForValidation: false,
    });
    expect(r.mediaBlocked).toBe(true);
  });

  it("allows linkedin draft path with account", () => {
    const r = resolveSocialStudioPromoteReadiness({
      targetPlatform: "linkedin",
      socialAccount: acc("linkedin"),
      postMode: "draft",
      scheduledAtIso: null,
      campaignAssetId: null,
      assetCreativeType: null,
      hasHostedHttpsAssetUrl: false,
      treatAsHasStorageUrlForValidation: false,
    });
    expect(r.publishNowReady).toBe(true);
  });
});
