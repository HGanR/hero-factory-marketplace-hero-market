import { describe, expect, it } from "@jest/globals";
import { autoFixConversionPath, evaluateConversionPath } from "@/lib/site-builder/conversion-engine";

const BASE = (blocks: unknown[]) =>
  JSON.stringify({
    pages: [{ slug: "/", blocks }],
    metadata: {},
  });

describe("conversion-engine", () => {
  it("site missing CTA scores low", () => {
    const audit = evaluateConversionPath(
      BASE([{ type: "hero", content: { aiSectionId: "hero-1", title: "Welcome", subtitle: "Intro" } }]),
    );
    expect(audit.score).toBeLessThan(70);
    expect(audit.issues.join(" ")).toMatch(/CTA/i);
  });

  it("adding CTA improves score", () => {
    const low = evaluateConversionPath(BASE([{ type: "hero", content: { title: "Welcome" } }]));
    const high = evaluateConversionPath(
      BASE([
        { type: "hero", content: { title: "Welcome", label: "Book", href: "/book" } },
        { type: "call_to_action", content: { title: "Start", label: "Go", href: "/go" } },
      ]),
    );
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("missing trust section triggers recommendation", () => {
    const audit = evaluateConversionPath(
      BASE([
        { type: "hero", content: { title: "Welcome", label: "Book", href: "/book" } },
        { type: "call_to_action", content: { title: "Start", label: "Go", href: "/go" } },
      ]),
    );
    expect(audit.recommendedActions.join(" ")).toMatch(/trust|testimonials|proof/i);
  });

  it("auto-fix adds conversion blocks", () => {
    const fixed = autoFixConversionPath(
      BASE([{ type: "hero", content: { aiSectionId: "hero-1", title: "Welcome" } }]),
    );
    expect(fixed.audit.score).toBeGreaterThan(60);
    const txt = fixed.schemaText.toLowerCase();
    expect(txt).toContain("call_to_action");
    expect(txt).toContain("trusted by clients");
  });
});
