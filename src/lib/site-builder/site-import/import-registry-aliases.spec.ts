/** @jest-environment node */
import { resolveImportRegistryKey } from "@/lib/site-builder/site-import/import-registry-aliases";

describe("import registry aliases", () => {
  it("maps legacy import keys to planner registry keys", () => {
    expect(resolveImportRegistryKey("import_hero")).toBe("hero_primary");
    expect(resolveImportRegistryKey("import_content")).toBe("paragraph_intro");
    expect(resolveImportRegistryKey("import_media")).toBe("image_spotlight");
    expect(resolveImportRegistryKey("import_cta")).toBe("mid_cta");
    expect(resolveImportRegistryKey("import_footer")).toBe("footer_standard");
    expect(resolveImportRegistryKey("import_route_stub")).toBe("paragraph_intro");
  });

  it("passes through native registry keys", () => {
    expect(resolveImportRegistryKey("hero_primary")).toBe("hero_primary");
    expect(resolveImportRegistryKey("paragraph_intro")).toBe("paragraph_intro");
  });
});
