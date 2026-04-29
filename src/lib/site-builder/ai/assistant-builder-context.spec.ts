/** @jest-environment node */
import { buildSiteBuilderAssistantContractAppendix } from "@/lib/site-builder/ai/assistant-builder-context";

describe("assistant-builder-context", () => {
  it("lists image_spotlight, import redesign rules, and composition", () => {
    const s = buildSiteBuilderAssistantContractAppendix();
    expect(s).toContain("image_spotlight");
    expect(s).toContain("SiteSchemaDocument");
    expect(s).toContain("hero");
    expect(s).toContain("call_to_action");
    expect(s).toContain("IMPORT");
    expect(s).toContain("footer_standard");
  });
});
