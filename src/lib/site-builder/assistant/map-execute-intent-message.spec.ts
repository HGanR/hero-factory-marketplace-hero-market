import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";

function sampleDoc() {
  return SiteSchemaDocument.parse({
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              aiSectionId: "sec-hero-1",
              aiRegistryKey: "hero_primary",
              title: "Headline",
              subtitle: "Sub",
            },
          },
          {
            type: "section",
            content: {
              aiSectionId: "sec-stats-1",
              aiRegistryKey: "stat_band",
              title: "Stats",
              body: "…",
            },
          },
        ],
      },
    ],
    metadata: { title: "T", governance: {} },
  });
}

describe("mapExecuteIntentMessage", () => {
  it("maps modern + rewrite hero compound message", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: "make the site more modern and rewrite the hero",
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.meta.needsClarification).toBe(false);
    expect(out.actions.some((a) => a.action === "set_theme_tokens")).toBe(true);
    expect(out.actions.some((a) => a.action === "regenerate_section" && a.sectionId === "sec-hero-1")).toBe(true);
    expect(out.meta.intent).toBe("multi");
  });

  it("maps add pricing section", () => {
    const out = mapExecuteIntentMessage({
      message: "add a pricing section",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({ action: "add_section", template: "section" });
    expect(out.meta.intent).toBe("structural_edit");
  });

  it("maps remove stats section", () => {
    const out = mapExecuteIntentMessage({
      message: "remove the stats section",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({ action: "remove_section", aiSectionId: "sec-stats-1" });
  });

  it("returns clarification when section is ambiguous", () => {
    const schema = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: { aiSectionId: "h1", aiRegistryKey: "hero_primary", title: "A", subtitle: "s" },
            },
            {
              type: "hero",
              content: { aiSectionId: "h2", aiRegistryKey: "hero_primary_split", title: "B", subtitle: "s" },
            },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const out = mapExecuteIntentMessage({
      message: "rewrite the hero",
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.meta.needsClarification).toBe(true);
    expect(out.actions).toHaveLength(0);
  });

  it("uses editContext lastSectionId for generic rewrite", () => {
    const out = mapExecuteIntentMessage({
      message: "rewrite this section",
      schema: sampleDoc(),
      editContext: { lastSectionIds: ["sec-stats-1"], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "regenerate_section",
      sectionId: "sec-stats-1",
    });
  });

  it("maps import with URL", () => {
    const out = mapExecuteIntentMessage({
      message: "import this site https://example.com/page",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "import_blueprint_from_url",
      url: "https://example.com/page",
    });
    expect(out.meta.intent).toBe("import");
  });

  it("maps white background to preview-visible custom_color tokens", () => {
    const out = mapExecuteIntentMessage({
      message: "change the background to a white color",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    const st = out.actions.find((a) => a.action === "set_theme_tokens");
    expect(st).toBeDefined();
    expect(st).toMatchObject({
      action: "set_theme_tokens",
      backgroundMode: "custom_color",
      backgroundColor: "#ffffff",
    });
  });

  it("keeps web3 style while forcing white surface and bold when asked together", () => {
    const out = mapExecuteIntentMessage({
      message: "web3 consulting landing with white background and bold text",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    const st = out.actions.filter((a) => a.action === "set_theme_tokens");
    expect(st.length).toBe(1);
    expect(st[0]).toMatchObject({
      styleMode: "bold",
      backgroundMode: "custom_color",
      backgroundColor: "#ffffff",
    });
  });

  it("deploy intent returns no actions", () => {
    const out = mapExecuteIntentMessage({
      message: "deploy the site",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions).toHaveLength(0);
    expect(out.meta.intent).toBe("deploy");
  });

  const hubClientUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("maps prepare client portal when schema has clientId", () => {
    const schema = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hi" } }] }],
      metadata: { title: "T", description: "D", governance: {}, clientId: hubClientUuid },
    });
    const out = mapExecuteIntentMessage({
      message: "prepare client portal",
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "prepare_client_portal",
      siteClientId: hubClientUuid,
      buildForClient: true,
    });
  });

  it("maps invite_client_to_portal with confirmed false when email present", () => {
    const schema = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hi" } }] }],
      metadata: { title: "T", description: "D", governance: {}, clientId: hubClientUuid },
    });
    const out = mapExecuteIntentMessage({
      message: `invite client to portal client@example.com`,
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "invite_client_to_portal",
      clientId: hubClientUuid,
      email: "client@example.com",
      confirmed: false,
    });
  });

  it("maps open client command center with uuid in message", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: `open client command center ${hubClientUuid}`,
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "open_client_command_center",
      clientId: hubClientUuid,
    });
  });

  it("maps selected section background to set_section_background only", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: "change the background of this section to white",
      schema,
      editContext: { lastSectionIds: ["sec-stats-1"], lastPageSlug: "/" },
    });
    expect(out.meta.needsClarification).toBe(false);
    const bg = out.actions.find((a) => a.action === "set_section_background");
    expect(bg).toMatchObject({
      action: "set_section_background",
      sectionId: "sec-stats-1",
      color: "#ffffff",
      pageSlug: "/",
    });
    expect(out.actions.some((a) => a.action === "set_theme_tokens")).toBe(false);
    expect(out.meta.intent).toBe("style_edit");
  });

  it("maps make this section white with selected id", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: "make this section white",
      schema,
      editContext: { lastSectionIds: ["sec-stats-1"], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "set_section_background",
      sectionId: "sec-stats-1",
      color: "#ffffff",
    });
  });

  it("asks which section when scoped background intent but no selection", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: "make this section white",
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.meta.needsClarification).toBe(true);
    expect(out.actions).toHaveLength(0);
    expect(out.meta.clarificationQuestion).toMatch(/Which section should I change/i);
  });

  it("maps hero background to white without canvas selection", () => {
    const schema = sampleDoc();
    const out = mapExecuteIntentMessage({
      message: "change hero background to white",
      schema,
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "set_section_background",
      sectionId: "sec-hero-1",
      color: "#ffffff",
    });
  });

  it("maps attach agent with widget appearance colors", () => {
    const agentId = "6ad15db0-bfcd-4cde-a8f8-3f7b228dfe0b";
    const out = mapExecuteIntentMessage({
      message: `attach agent ${agentId} and make the AI bubble white with blue border and dark blue chat header`,
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    expect(out.actions[0]).toMatchObject({
      action: "attach_agent_to_client_site",
      agentId,
      widgetBubbleColor: "white",
      avatarBorderColor: "blue",
    });
  });
});
