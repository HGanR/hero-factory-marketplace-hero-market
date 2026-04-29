import { describe, it, expect } from "@jest/globals";
import { projectCampaignAssetMetadata } from "@/lib/social/campaign-asset-metadata";

describe("projectCampaignAssetMetadata", () => {
  it("extracts flat fields", () => {
    const m = projectCampaignAssetMetadata({
      mimeType: "image/png",
      width: 800,
      height: 600,
      durationSeconds: 12,
      extension: "png",
    });
    expect(m.mimeType).toBe("image/png");
    expect(m.width).toBe(800);
    expect(m.height).toBe(600);
    expect(m.durationSeconds).toBe(12);
    expect(m.extension).toBe("png");
  });

  it("handles null metadata", () => {
    const m = projectCampaignAssetMetadata(null);
    expect(m.mimeType).toBeNull();
  });
});
