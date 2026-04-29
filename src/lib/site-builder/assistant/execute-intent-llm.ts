import { z } from "zod";
import { extractJsonFromLlmText } from "@/lib/revenue-os/extractLlmJson";
import type { LlmMessage } from "@/lib/npc/llm";
import { BuilderActionSchema, type BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { ExecuteIntentResponse } from "@/lib/site-builder/assistant/execute-intent-types";

const LlmExecuteIntentSchema = z.object({
  intent: z.string().min(1).max(80),
  assistantReply: z.string().max(600),
  actions: z.array(BuilderActionSchema).max(24),
});

function summarizeBlocks(doc: SiteSchemaDocumentType, pageSlug: string, maxBlocks: number): string {
  const page = doc.pages.find((p) => p.slug === pageSlug);
  if (!page) return "(no page)";
  const lines: string[] = [];
  for (let i = 0; i < page.blocks.length && i < maxBlocks; i++) {
    const b = page.blocks[i]!;
    const c = b.content as { aiSectionId?: string; aiRegistryKey?: string } | undefined;
    lines.push(
      `- index ${i} type=${b.type} aiSectionId=${String(c?.aiSectionId || "")} registryKey=${String(c?.aiRegistryKey || "")}`,
    );
  }
  return lines.join("\n");
}

const SYSTEM = `You are a site-builder command router. Output ONLY JSON (no markdown) with this exact shape:
{"intent":"structural_edit|copy_edit|style_edit|section_regen|pipeline_full|import|deploy|unclear|multi","assistantReply":"short confirmation","actions":[...]}

Each item in actions must be a valid builder action object with an "action" discriminator field.
Allowed action values include: validate_schema, create_page, update_page_metadata, add_section, remove_section, move_section, update_copy, set_theme_tokens, set_section_background, set_section_text_color, set_section_accent_color, update_section_style, set_footer, set_nav_text_block, map_html_to_schema, normalize_imported_markup, map_import_to_builder_schema, import_blueprint_from_url, regenerate_section, export_project_validate, save_project, render_preview_ack, prepare_client_portal, open_client_command_center, invite_client_to_portal, attach_agent_to_client_site, mark_client_portal_invite_sent, mark_client_portal_active.

Prefer small action sets (1–3). For full-site theme use set_theme_tokens. For a single block surface use set_section_background / set_section_text_color / set_section_accent_color with sectionId from the list (or the user-selected section id in editContext). For AI rewrites use regenerate_section with sectionId from the block list OR target descriptor. Do not invent sectionIds — pick from the provided list.

For publish/deploy or full-site regeneration, return actions: [] and intent deploy or pipeline_full with a short assistantReply telling the user to use the builder UI.

When attaching an agent, ask (or map) avatar/bubble colors with attach_agent_to_client_site fields: avatarBorderColor, widgetBubbleColor, widgetHeaderColor, widgetWindowBackgroundColor.

Never include commentary outside JSON.`;

/**
 * Optional LLM pass when deterministic rules return no actions.
 */
export async function tryExecuteIntentWithLlm(args: {
  message: string;
  schema: SiteSchemaDocumentType;
  pageSlug: string;
  lastSectionIds: string[];
  invokeLlm: (messages: LlmMessage[]) => Promise<string | null>;
}): Promise<ExecuteIntentResponse | null> {
  const user = JSON.stringify(
    {
      message: args.message,
      pageSlug: args.pageSlug,
      lastSectionIds: args.lastSectionIds,
      blocks: summarizeBlocks(args.schema, args.pageSlug, 48),
    },
    null,
    0,
  );
  const raw = await args.invokeLlm([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
  if (!raw) return null;
  const parsed = extractJsonFromLlmText(raw);
  const llm = LlmExecuteIntentSchema.safeParse(parsed);
  if (!llm.success) return null;
  const actions: BuilderAction[] = [];
  for (const a of llm.data.actions) {
    const one = BuilderActionSchema.safeParse(a);
    if (one.success) actions.push(one.data);
  }
  const intentStr = typeof llm.data.intent === "string" ? llm.data.intent : "unclear";
  if (actions.length === 0) {
    return {
      actions: [],
      assistantReply:
        llm.data.assistantReply.trim() ||
        "I could not produce executable builder actions for that request — try naming a section or a concrete visual change.",
      meta: {
        intent: "unclear",
        needsClarification: true,
        clarificationQuestion:
          "Which part of the page should change, and how (for example background color, shorter copy, or a specific section)?",
      },
    };
  }
  return {
    actions,
    assistantReply: llm.data.assistantReply.trim() || "Here are the planned builder updates.",
    meta: {
      intent: intentStr,
      needsClarification: false,
      clarificationQuestion: undefined,
    },
  };
}
