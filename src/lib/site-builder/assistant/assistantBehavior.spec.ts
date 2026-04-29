import { describe, expect, it } from "@jest/globals";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  analyzeAssistantPrompt,
  buildPostEditFollowup,
  deriveAssistantStatusLabel,
} from "@/lib/site-builder/assistant/assistantBehavior";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";

describe("analyzeAssistantPrompt", () => {
  it("asks clarification for vague improvement", () => {
    const out = analyzeAssistantPrompt("Make it better", { lastSectionIds: [], lastPageSlug: "/" });
    expect(out.canAct).toBe(false);
    expect(out.clarificationQuestion).toMatch(/copy, layout, colors, or CTA/i);
    expect(out.inferredIntent).toBe("vague_improvement");
  });

  it("asks which section for change this with no selection", () => {
    const out = analyzeAssistantPrompt("Change this", { lastSectionIds: [], lastPageSlug: "/" });
    expect(out.canAct).toBe(false);
    expect(out.clarificationQuestion).toMatch(/Which section should I change/i);
  });

  it("allows change this when a section is selected", () => {
    const out = analyzeAssistantPrompt("Change this", { lastSectionIds: ["sec-1"], lastPageSlug: "/" });
    expect(out.canAct).toBe(true);
  });

  it("asks form type for add a form", () => {
    const out = analyzeAssistantPrompt("Add a form", { lastSectionIds: [], lastPageSlug: "/" });
    expect(out.canAct).toBe(false);
    expect(out.clarificationQuestion).toMatch(/lead form, booking form, contact form, or quote form/i);
  });

  it("does not block add a contact form", () => {
    const out = analyzeAssistantPrompt("Add a contact form below the hero", { lastSectionIds: [], lastPageSlug: "/" });
    expect(out.canAct).toBe(true);
  });
});

describe("deriveAssistantStatusLabel", () => {
  it("shows Critiquing and Improving during build phases", () => {
    expect(
      deriveAssistantStatusLabel({ nlApplying: false, busy: true, buildPhase: "critiquing", showRefine: true }),
    ).toBe("Critiquing");
    expect(
      deriveAssistantStatusLabel({ nlApplying: false, busy: true, buildPhase: "improving", showRefine: true }),
    ).toBe("Improving");
    expect(
      deriveAssistantStatusLabel({ nlApplying: false, busy: true, buildPhase: "building", showRefine: false }),
    ).toBe("Building");
  });

  it("shows Applying edit when NL pipeline is applying", () => {
    expect(deriveAssistantStatusLabel({ nlApplying: true, busy: true, buildPhase: "idle", showRefine: true })).toBe(
      "Applying edit",
    );
  });

  it("shows Ready when idle in describe/publish", () => {
    expect(deriveAssistantStatusLabel({ nlApplying: false, busy: false, buildPhase: "idle", showRefine: false })).toBe(
      "Ready",
    );
  });
});

describe("buildPostEditFollowup", () => {
  it("suggests proof after hero regeneration", () => {
    const schema = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: { aiSectionId: "h1", aiRegistryKey: "hero_primary", title: "X", subtitle: "Y" },
            },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const actions = [{ action: "regenerate_section", sectionId: "h1", instruction: "Stronger" }] as BuilderAction[];
    const hint = buildPostEditFollowup({
      actions,
      schema,
      lastPageSlug: "/",
      lastSectionIds: ["h1"],
    });
    expect(hint).toMatch(/proof point/i);
  });

  it("suggests contrast after white section background", () => {
    const schema = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "section",
              content: { aiSectionId: "s1", title: "A", body: "b", style: { backgroundColor: "#ffffff" } },
            },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const actions = [{ action: "set_section_background", pageSlug: "/", sectionId: "s1", color: "#ffffff" }] as BuilderAction[];
    const hint = buildPostEditFollowup({
      actions,
      schema,
      lastPageSlug: "/",
      lastSectionIds: ["s1"],
    });
    expect(hint).toMatch(/contrast|darker text/i);
  });
});
