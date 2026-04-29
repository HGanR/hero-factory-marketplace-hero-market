import { z } from "zod";
import { SiteWidgetPlacementSchema } from "@/lib/site-builder/schema";
import {
  BackgroundModeSchema,
  CinematicButtonStyleSchema,
  DepthStyleSchema,
  GradientStyleSchema,
  MotionHintSchema,
  SitePlannerInputSchema,
} from "@/lib/site-builder/ai/schemas";
import {
  SectionTargetDescriptorSchema,
  hasNonemptyTarget,
} from "@/lib/site-builder/builder-actions/resolve-section-target";

const PageSlugSchema = z.string().min(1).max(200);

const BuilderTemplateKeyZ = z.enum([
  "hero",
  "heading",
  "paragraph",
  "section",
  "button",
  "image",
  "footer",
  "divider",
  "call_to_action",
  "link",
]);

/** One builder tool action — validated before touching canonical schema. */
export const BuilderActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("validate_schema"),
  }),
  z.object({
    action: z.literal("create_page"),
    slug: PageSlugSchema,
    title: z.string().max(200).optional(),
    duplicateBlocksFromSlug: PageSlugSchema.optional(),
  }),
  z.object({
    action: z.literal("update_page_metadata"),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    keywords: z.array(z.string().max(80)).max(48).optional(),
    canonicalUrl: z.string().max(500).optional(),
    robots: z.string().max(120).optional(),
  }),
  z.object({
    action: z.literal("apply_seo_enrichment"),
    focusPrompt: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal("add_section"),
    pageSlug: PageSlugSchema.default("/"),
    template: BuilderTemplateKeyZ,
    index: z.number().int().min(0).max(200).optional(),
    /** Shallow merge into template `content` (and top-level `src`/`href` for image/link types). */
    contentPatch: z.record(z.string(), z.unknown()).optional(),
  }),
  z
    .object({
      action: z.literal("remove_section"),
      pageSlug: PageSlugSchema.default("/"),
      index: z.number().int().min(0).max(200).optional(),
      aiSectionId: z.string().min(1).max(120).optional(),
      target: SectionTargetDescriptorSchema.optional(),
    })
    .superRefine((d, ctx) => {
      const hasIdx = d.index !== undefined;
      const hasSid = Boolean(d.aiSectionId?.trim());
      const hasT = hasNonemptyTarget(d.target);
      const n = Number(hasIdx) + Number(hasSid) + Number(hasT);
      if (n !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "remove_section: provide exactly one of index, aiSectionId, or target",
        });
      }
    }),
  z.object({
    action: z.literal("move_section"),
    pageSlug: PageSlugSchema.default("/"),
    fromIndex: z.number().int().min(0).max(200),
    toIndex: z.number().int().min(0).max(200),
  }),
  z
    .object({
      action: z.literal("update_copy"),
      pageSlug: PageSlugSchema.default("/"),
      aiSectionId: z.string().max(120).optional(),
      target: SectionTargetDescriptorSchema.optional(),
      patches: z
        .object({
          title: z.string().max(500).optional(),
          subtitle: z.string().max(2000).optional(),
          body: z.string().max(12000).optional(),
          text: z.string().max(12000).optional(),
          label: z.string().max(300).optional(),
        })
        .strict(),
    })
    .superRefine((d, ctx) => {
      const hasId = Boolean(d.aiSectionId?.trim());
      const hasT = hasNonemptyTarget(d.target);
      if (hasId === hasT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "update_copy: provide exactly one of aiSectionId or target",
        });
      }
    }),
  z.object({
    action: z.literal("set_theme_tokens"),
    styleMode: z.enum(["web3", "corporate", "minimal", "bold"]).optional(),
    gradientStart: z.string().max(40).optional(),
    gradientEnd: z.string().max(40).optional(),
    backgroundColor: z.string().max(40).optional(),
    backgroundMode: BackgroundModeSchema.optional(),
    accent: z.string().max(80).optional(),
    gradientStyle: GradientStyleSchema.optional(),
    buttonStyle: CinematicButtonStyleSchema.optional(),
    depthStyle: DepthStyleSchema.optional(),
    motionHint: MotionHintSchema.optional(),
  }),
  z.object({
    action: z.literal("set_section_background"),
    pageSlug: PageSlugSchema.default("/"),
    sectionId: z.string().min(1).max(120),
    color: z.string().min(1).max(40),
    scope: z.literal("selected_section").optional(),
  }),
  z.object({
    action: z.literal("set_section_text_color"),
    pageSlug: PageSlugSchema.default("/"),
    sectionId: z.string().min(1).max(120),
    color: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("set_section_accent_color"),
    pageSlug: PageSlugSchema.default("/"),
    sectionId: z.string().min(1).max(120),
    color: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("update_section_style"),
    pageSlug: PageSlugSchema.default("/"),
    sectionId: z.string().min(1).max(120),
    stylePatch: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("set_footer"),
    pageSlug: PageSlugSchema.default("/"),
    body: z.string().min(1).max(8000),
    mode: z.enum(["replace_first", "append"]).default("replace_first"),
  }),
  z.object({
    action: z.literal("set_nav_text_block"),
    pageSlug: PageSlugSchema.default("/"),
    /** Plain lines; rendered as a paragraph or appended to first section — we use a new paragraph block. */
    lines: z.array(z.string().max(500)).max(40),
    position: z.enum(["top", "bottom"]).default("top"),
  }),
  z.object({
    action: z.literal("map_html_to_schema"),
    html: z.string().min(1).max(2_500_000),
    sourceUrl: z.string().min(4).max(2000),
  }),
  z.object({
    action: z.literal("normalize_imported_markup"),
    html: z.string().min(1).max(2_500_000),
    sourceUrl: z.string().min(4).max(2000),
  }),
  z.object({
    action: z.literal("map_import_to_builder_schema"),
    html: z.string().min(1).max(2_500_000),
    sourceUrl: z.string().min(4).max(2000),
    widgetKey: z.string().min(8).max(80).optional(),
    widgetPlacement: SiteWidgetPlacementSchema.optional(),
    loaderOrigin: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("import_blueprint_from_url"),
    url: z.string().min(4).max(2000),
    widgetKey: z.string().min(8).max(80).optional(),
    widgetPlacement: SiteWidgetPlacementSchema.optional(),
    loaderOrigin: z.string().max(500).optional(),
  }),
  z
    .object({
      action: z.literal("regenerate_section"),
      sectionId: z.string().max(120).optional(),
      target: SectionTargetDescriptorSchema.optional(),
      instruction: z.string().max(4000).optional(),
      input: SitePlannerInputSchema.partial().optional(),
    })
    .superRefine((d, ctx) => {
      const hasId = Boolean(d.sectionId?.trim());
      const hasT = hasNonemptyTarget(d.target);
      if (hasId === hasT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "regenerate_section: provide exactly one of sectionId or target",
        });
      }
    }),
  z.object({
    action: z.literal("export_project_validate"),
  }),
  z.object({
    action: z.literal("save_project"),
    /** Client persists schema via version APIs; server returns ack only. */
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("render_preview_ack"),
    /** No-op for server; documents that client should re-read schema for preview. */
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("prepare_client_portal"),
    buildForClient: z.boolean().optional(),
    siteClientId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("open_client_command_center"),
    clientId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("upsert_domain_connection"),
    domain: z.string().min(1).max(255),
    domainType: z.enum(["web2", "freename_web3", "other_web3"]),
    provider: z.enum(["freename", "vercel", "external"]),
    deploymentTarget: z.enum(["vercel_deployment_url", "vercel_custom_domain", "static_export_url"]),
    targetUrl: z.string().url().max(2000),
  }),
  z.object({
    action: z.literal("invite_client_to_portal"),
    clientId: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["owner", "manager", "viewer"]).optional(),
    /** Must be true to actually create an invite (operator confirmation). */
    confirmed: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("attach_agent_to_client_site"),
    agentId: z.string().uuid(),
    clientId: z.string().uuid().optional(),
    mergeWidgetIntoSchema: z.boolean().optional(),
    avatarBorderColor: z.string().max(32).optional(),
    widgetBubbleColor: z.string().max(32).optional(),
    widgetHeaderColor: z.string().max(32).optional(),
    widgetWindowBackgroundColor: z.string().max(32).optional(),
  }),
  z.object({
    action: z.literal("mark_client_portal_invite_sent"),
  }),
  z.object({
    action: z.literal("mark_client_portal_active"),
  }),
]);

export type BuilderAction = z.infer<typeof BuilderActionSchema>;

export const BuilderActionsRequestSchema = z.object({
  schemaJson: z.unknown(),
  actions: z.array(BuilderActionSchema).min(1).max(48),
  /** When set, resolves BYOK / managed LLM for regenerate_section and is logged. */
  siteId: z.string().uuid().optional(),
  /** Optional version context for audit logs only. */
  versionId: z.string().uuid().optional(),
  /** Source label for action run logs. */
  source: z.enum(["api", "ai_panel", "manual", "system"]).optional(),
});

export type BuilderActionsRequest = z.infer<typeof BuilderActionsRequestSchema>;
