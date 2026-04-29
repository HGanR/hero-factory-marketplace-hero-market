import { describe, it, expect } from "@jest/globals";
import {
  instagramScheduledPostRequiresAsset,
  validateComposerSocialPostMedia,
} from "@/lib/social/social-post-create-rules";

describe("instagramScheduledPostRequiresAsset", () => {
  it("is false for non-instagram", () => {
    expect(
      instagramScheduledPostRequiresAsset({
        provider: "linkedin",
        scheduledFor: "2026-01-01T00:00:00.000Z",
        assetId: null,
      })
    ).toBe(false);
  });

  it("is false for instagram draft (no schedule)", () => {
    expect(
      instagramScheduledPostRequiresAsset({
        provider: "instagram",
        scheduledFor: undefined,
        assetId: null,
      })
    ).toBe(false);
  });

  it("is true when instagram scheduled without asset", () => {
    expect(
      instagramScheduledPostRequiresAsset({
        provider: "instagram",
        scheduledFor: "2026-01-01T00:00:00.000Z",
        assetId: null,
      })
    ).toBe(true);
  });

  it("is false when instagram scheduled with asset", () => {
    expect(
      instagramScheduledPostRequiresAsset({
        provider: "instagram",
        scheduledFor: "2026-01-01T00:00:00.000Z",
        assetId: "asset-uuid",
      })
    ).toBe(false);
  });
});

describe("validateComposerSocialPostMedia", () => {
  it("rejects instagram scheduled without asset", () => {
    const r = validateComposerSocialPostMedia({
      provider: "instagram",
      scheduledFor: "2026-01-01T00:00:00.000Z",
      assetId: null,
      assetCreativeType: null,
      hasStorageUrl: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INSTAGRAM_REQUIRES_MEDIA");
  });

  it("rejects instagram with TEXT asset", () => {
    const r = validateComposerSocialPostMedia({
      provider: "instagram",
      scheduledFor: undefined,
      assetId: "a1",
      assetCreativeType: "TEXT",
      hasStorageUrl: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PROVIDER_MEDIA_UNSUPPORTED_TYPE");
  });

  it("accepts instagram IMAGE with URL", () => {
    expect(
      validateComposerSocialPostMedia({
        provider: "instagram",
        scheduledFor: "2026-01-01T00:00:00.000Z",
        assetId: "a1",
        assetCreativeType: "IMAGE",
        hasStorageUrl: true,
      }).ok
    ).toBe(true);
  });

  it("rejects instagram IMAGE without storage URL", () => {
    const r = validateComposerSocialPostMedia({
      provider: "instagram",
      scheduledFor: "2026-01-01T00:00:00.000Z",
      assetId: "a1",
      assetCreativeType: "IMAGE",
      hasStorageUrl: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MEDIA_ASSET_MISSING_URL");
  });

  it("rejects facebook VIDEO attachment", () => {
    const r = validateComposerSocialPostMedia({
      provider: "facebook",
      scheduledFor: undefined,
      assetId: "v1",
      assetCreativeType: "VIDEO",
      hasStorageUrl: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FACEBOOK_VIDEO_NOT_SUPPORTED");
  });

  it("accepts facebook IMAGE with URL", () => {
    expect(
      validateComposerSocialPostMedia({
        provider: "facebook",
        scheduledFor: undefined,
        assetId: "i1",
        assetCreativeType: "IMAGE",
        hasStorageUrl: true,
      }).ok
    ).toBe(true);
  });

  it("allows linkedin with any optional asset id (no media gate)", () => {
    expect(
      validateComposerSocialPostMedia({
        provider: "linkedin",
        scheduledFor: "2026-01-01T00:00:00.000Z",
        assetId: "x",
        assetCreativeType: "TEXT",
        hasStorageUrl: false,
      }).ok
    ).toBe(true);
  });
});
