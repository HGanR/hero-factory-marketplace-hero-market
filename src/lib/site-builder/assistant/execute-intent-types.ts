import { z } from "zod";
import { BuilderActionSchema, type BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";

export const ExecuteIntentKindSchema = z.enum([
  "structural_edit",
  "copy_edit",
  "style_edit",
  "section_regen",
  "pipeline_full",
  "import",
  "deploy",
  "unclear",
  "multi",
]);

export type ExecuteIntentKind = z.infer<typeof ExecuteIntentKindSchema>;

export const ExecuteIntentRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  siteId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  schemaSnapshotHash: z.string().min(16).max(128).optional(),
  sessionId: z.string().min(1).max(120),
  editContext: z.object({
    lastSectionIds: z.array(z.string().min(1).max(120)).max(3),
    lastPageSlug: z.string().min(1).max(200),
  }),
});

export type ExecuteIntentRequest = z.infer<typeof ExecuteIntentRequestSchema>;

export const ExecuteIntentResponseSchema = z.object({
  actions: z.array(BuilderActionSchema),
  assistantReply: z.string(),
  meta: z.object({
    intent: z.string(),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().max(500).optional(),
  }),
});

export type ExecuteIntentResponse = z.infer<typeof ExecuteIntentResponseSchema>;

export type ExecuteIntentMappingInput = {
  message: string;
  /** Parsed site document */
  schema: import("@/lib/site-builder/schema").SiteSchemaDocumentType;
  editContext: ExecuteIntentRequest["editContext"];
};

export function emptyExecuteIntentResponse(
  partial: Pick<ExecuteIntentResponse, "assistantReply"> & {
    meta: ExecuteIntentResponse["meta"];
  },
): ExecuteIntentResponse {
  return {
    actions: [],
    assistantReply: partial.assistantReply,
    meta: partial.meta,
  };
}

export function classifyIntentFromActions(actions: BuilderAction[]): ExecuteIntentKind {
  if (actions.length === 0) return "unclear";
  const kinds = new Set<string>();
  for (const a of actions) {
    switch (a.action) {
      case "add_section":
      case "remove_section":
      case "move_section":
      case "create_page":
        kinds.add("structural_edit");
        break;
      case "update_copy":
      case "update_page_metadata":
      case "apply_seo_enrichment":
        kinds.add("copy_edit");
        break;
      case "set_theme_tokens":
      case "set_section_background":
      case "set_section_text_color":
      case "set_section_accent_color":
      case "update_section_style":
        kinds.add("style_edit");
        break;
      case "regenerate_section":
        kinds.add("section_regen");
        break;
      case "import_blueprint_from_url":
      case "map_import_to_builder_schema":
      case "map_html_to_schema":
        kinds.add("import");
        break;
      case "set_footer":
      case "set_nav_text_block":
        kinds.add("structural_edit");
        break;
      case "validate_schema":
      case "save_project":
      case "render_preview_ack":
      case "export_project_validate":
      case "normalize_imported_markup":
        break;
      default:
        kinds.add("structural_edit");
    }
  }
  if (kinds.size === 0) return "unclear";
  if (kinds.size > 1) return "multi";
  return (Array.from(kinds)[0] as ExecuteIntentKind) || "unclear";
}
