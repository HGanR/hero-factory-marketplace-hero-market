import { buildSiteBuilderParityFixture, SITE_BUILDER_PARITY_MODES } from "@/lib/site-builder/parity-fixtures";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";

describe("parity fixtures (Jest, no browser)", () => {
  for (const mode of SITE_BUILDER_PARITY_MODES) {
    it(`builds static bundle for ${mode}`, () => {
      const doc = buildSiteBuilderParityFixture(mode);
      expect(doc.pages[0]?.blocks.length).toBe(5);
      const { files } = generateStaticBundle(doc);
      expect(files.some((f) => f.path === "index.html")).toBe(true);
      expect(files.some((f) => f.path === "assets/site.css")).toBe(true);
    });
  }
});
