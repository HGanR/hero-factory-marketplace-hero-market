import { describe, expect, it } from "@jest/globals";
import { applyGlobalDesignTokenInstruction, isGlobalDesignTokenInstruction } from "@/lib/site-builder/token-edit-intelligence";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function emptyDoc(): SiteSchemaDocumentType {
  return {
    pages: [{ slug: "/", blocks: [] }],
    metadata: { title: "Site", theme: { styleMode: "corporate" } },
  };
}

describe("token edit intelligence", () => {
  it("isGlobalDesignTokenInstruction detects site-wide phrasing", () => {
    expect(isGlobalDesignTokenInstruction("Use a white background across the site")).toBe(true);
    expect(isGlobalDesignTokenInstruction("Make the hero headline shorter")).toBe(false);
  });

  it("applyGlobalDesignTokenInstruction mutates tokens for light site request", () => {
    const doc = emptyDoc();
    const r = applyGlobalDesignTokenInstruction(doc, "Switch to a light background site-wide");
    expect(r.applied).toBe(true);
    expect(r.kinds).toContain("color");
    expect(doc.metadata?.designSystem?.colors.background).toMatch(/^#/);
  });
});
