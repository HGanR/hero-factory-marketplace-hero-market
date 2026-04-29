import { resolveSocialStudioBrandDefaults } from "@/lib/revenue-os/social-studio-brand-defaults";

describe("resolveSocialStudioBrandDefaults", () => {
  it("derives from campaign name and bentley JSON when present", () => {
    const b = resolveSocialStudioBrandDefaults({
      name: "  Acme  ",
      bentleyGenerationJson: {
        accentColor: "#ff00aa",
        backgroundColor: "#111111",
        brandTone: "confident",
      },
    });
    expect(b.brandName).toBe("  Acme  ".trim());
    expect(b.primaryColor.toLowerCase()).toBe("#ff00aa");
    expect(b.secondaryColor).toBe("#111111");
    expect(b.toneHint).toBe("confident");
  });

  it("uses safe defaults when JSON missing or invalid", () => {
    const b = resolveSocialStudioBrandDefaults({ name: null, bentleyGenerationJson: { accentColor: "not-a-color" } });
    expect(b.brandName).toBe("Your brand");
    expect(b.primaryColor).toMatch(/^#/);
  });
});
