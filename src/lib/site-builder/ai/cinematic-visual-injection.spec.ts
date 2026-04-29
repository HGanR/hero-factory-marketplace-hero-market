import { describe, expect, it } from "@jest/globals";
import { ensureHeroCinematicQuality } from "@/lib/site-builder/ai/cinematic-visual-injection";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

describe("cinematic-visual-injection", () => {
  it("ensureHeroCinematicQuality upgrades plain color heroes to layered gradients", () => {
    const block: SiteSchemaDocumentType["pages"][number]["blocks"][number] = {
      type: "hero",
      content: {
        title: "T",
        subtitle: "S",
        visual: { gradient: "#0f172a" },
      },
    };
    ensureHeroCinematicQuality(block, { typographyTone: "bold" });
    const vis = (block.content as { visual?: { gradient?: string } }).visual;
    expect(String(vis?.gradient || "")).toMatch(/gradient/i);
    expect(String(vis?.gradient || "")).toMatch(/radial-gradient/i);
    expect((block.content as { motion?: { cinematic?: unknown } }).motion?.cinematic).toBeTruthy();
  });

  it("ensureHeroCinematicQuality appends radial depth when only linear gradient exists", () => {
    const block: SiteSchemaDocumentType["pages"][number]["blocks"][number] = {
      type: "hero",
      content: {
        title: "T",
        visual: { gradient: "linear-gradient(135deg, #0f172a, #1e293b)" },
      },
    };
    ensureHeroCinematicQuality(block, { typographyTone: "editorial" });
    const g = String((block.content as { visual?: { gradient?: string } }).visual?.gradient || "");
    expect(g).toMatch(/radial-gradient/i);
  });
});
