import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { runExecuteIntentAnalysis } from "@/lib/site-builder/assistant/run-execute-intent";

const minimalSchema = () =>
  SiteSchemaDocument.parse({
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              aiSectionId: "hero-1",
              aiRegistryKey: "hero_primary",
              title: "T",
              subtitle: "s",
            },
          },
        ],
      },
    ],
    metadata: { title: "x", governance: {} },
  });

describe("runExecuteIntentAnalysis", () => {
  it("returns behavior-layer clarification for vague prompts without calling LLM", async () => {
    const out = await runExecuteIntentAnalysis({
      message: "make it better",
      schema: minimalSchema(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
      invokeLlm: async () => {
        throw new Error("LLM should not run for vague prompt");
      },
    });
    expect(out.actions).toHaveLength(0);
    expect(out.meta.needsClarification).toBe(true);
    expect(out.assistantReply).toMatch(/copy, layout, colors, or CTA/i);
  });

  it("returns deterministic mapping without LLM", async () => {
    const out = await runExecuteIntentAnalysis({
      message: "make it modern",
      schema: minimalSchema(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]?.action).toBe("set_theme_tokens");
  });

  it("invokes LLM when rules yield no actions", async () => {
    const out = await runExecuteIntentAnalysis({
      message: "do the purple thing to section vibes",
      schema: minimalSchema(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
      invokeLlm: async () =>
        JSON.stringify({
          intent: "style_edit",
          assistantReply: "I'll switch to a minimal theme.",
          actions: [{ action: "set_theme_tokens", styleMode: "minimal" }],
        }),
    });
    expect(out.actions).toHaveLength(1);
    expect(out.meta.intent).toBe("style_edit");
  });

  it("skips LLM when absent and message is unmapped", async () => {
    const out = await runExecuteIntentAnalysis({
      message: "do the purple thing to section vibes",
      schema: minimalSchema(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions).toHaveLength(0);
    expect(out.meta.needsClarification).toBe(true);
  });

  it("treats LLM output with only invalid actions as clarification, not applied edits", async () => {
    const out = await runExecuteIntentAnalysis({
      message: "do the purple thing to section vibes",
      schema: minimalSchema(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
      invokeLlm: async () =>
        JSON.stringify({
          intent: "style_edit",
          assistantReply: "Applied purple theme.",
          actions: [{ action: "set_theme_tokens", styleMode: "not_a_valid_mode" }],
        }),
    });
    expect(out.actions).toHaveLength(0);
    expect(out.meta.needsClarification).toBe(true);
  });
});
