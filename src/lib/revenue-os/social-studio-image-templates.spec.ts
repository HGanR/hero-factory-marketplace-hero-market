import {
  SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG,
  buildNativeSocialImageSpecForStudioTemplate,
} from "@/lib/revenue-os/social-studio-image-templates";
import { buildNativeSocialImageSvg } from "@/lib/revenue-os/native-social-asset-image";

describe("social-studio-image-templates", () => {
  it("exposes a catalog for each id", () => {
    expect(SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG.linkedin_pro.layout).toBe("pro");
    expect(SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG.fb_square.defaultAspect).toBe("square");
  });

  it("buildNativeSocialImageSpecForStudioTemplate changes SVG output by template (deterministic)", () => {
    const brand = {
      brandName: "B",
      primaryColor: "#00ff00",
      secondaryColor: "#111111",
      logoUrl: null,
      toneHint: null,
    };
    const a = buildNativeSocialImageSvg(
      buildNativeSocialImageSpecForStudioTemplate({
        templateId: "quote",
        aspect: "square",
        brand,
        topic: "Hello",
        businessName: "Biz",
        contentEngine: null,
      })
    );
    const b = buildNativeSocialImageSvg(
      buildNativeSocialImageSpecForStudioTemplate({
        templateId: "offer",
        aspect: "square",
        brand,
        topic: "Hello",
        businessName: "Biz",
        contentEngine: null,
      })
    );
    expect(a).toContain("Hello");
    expect(b).toContain("Hello");
    expect(a).not.toEqual(b);
  });
});
