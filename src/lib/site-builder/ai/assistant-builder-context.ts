/**
 * Canonical contract text for LLM planners/regeneration — keeps outputs aligned with the real schema and block registry.
 */

import { listRegistryKeys } from "@/lib/site-builder/ai/block-registry";

const BLOCK_TYPES = [
  "hero",
  "text",
  "image",
  "button",
  "section",
  "footer",
  "avatar",
  "heading",
  "paragraph",
  "link",
  "socials",
  "image_grid",
  "list",
  "divider",
  "big_link",
  "internal_big_link",
  "header_image",
  "audio",
  "file",
  "video",
  "call_to_action",
  "visual_break",
  "stat_band",
] as const;

const REGISTRY_COMPOSITION_RULES = `
SECTION COMPOSITION (planner sectionPlan):
- Typical home flow: hero variant → paragraph_intro or trust_strip → value_props or feature_grid → stat_band (optional) → social_proof → mid_cta → faq (optional) → footer_standard.
- Alternate rhythm: insert visual_break_gradient or glow_strip between dense content runs.
- web3_product intent: prefer web3_ribbon once in upper-mid page; keep footer_standard last.
- Keep 8–14 registry entries; every registryKey must appear in the allowed list.
`.trim();

const BLOCK_TEMPLATES = `
BLOCK TEMPLATES (persisted shape — content is illustrative):
- hero: { type:"hero", content:{ title, subtitle?, variant?, layout?, visual:{ gradient, accent, gridOverlay, background?:{type:"image"|"color"|"video", value, behavior?, fallbackColor?} }, aiSectionId, aiRegistryKey:"hero_primary"|... } }
- section: { type:"section", content:{ title, body, aiSectionId, aiRegistryKey:"paragraph_intro" } }
- paragraph: { type:"paragraph", content:{ text or body, aiSectionId, aiRegistryKey } }
- image: { type:"image", src, content:{ alt, aiRegistryKey:"image_spotlight", importAssetRef?, importAssetPolicy?:"hotlink_preview" } }
- button: { type:"button", content:{ label, href, aiRegistryKey:"mid_cta" } }
- call_to_action: { type:"call_to_action", content:{ title, body, label, href, visual?, aiRegistryKey:"mid_cta" } }
- footer: { type:"footer", content:{ body, aiRegistryKey:"footer_standard" } }
- image_grid / list / stat_band / divider: use schema-allowed fields only; include aiSectionId + aiRegistryKey when targeting Refine.
`.trim();

const IMPORT_TRANSFORM_RULES = `
IMPORT → IMPROVE (NOT CLONE):
- When metadata.siteImport.sourceUrl exists, treat the draft as a reconstruction blueprint from a public URL — not a licensed clone or lift-and-shift.
- Default assistant behavior: improve layout, sharpen copy, strengthen primary CTA, align to design tokens, modernize visuals — preserve the visitor-facing intent and information hierarchy unless the user asks for a full reset.
- Do not promise pixel parity, do not assume scripts/APIs/private pages were captured, and do not invent URLs or assets that were not imported or uploaded.
- Hotlinked images (importAssetPolicy hotlink_preview) may need upload or proxy for reliable export — say so when recommending media work.
- Reconstruction paths (metadata.siteImport.reconstruction.path): native | semantic_enriched | metadata_mvp | invariant_repair — lower paths mean weaker HTML; be conservative and actionable.
`.trim();

const FUTURE_HOOKS = `
FUTURE (product hooks — do not claim as live features unless confirmed):
- Multi-page crawl, asset bundling into siteBuilderAssets, and optional “full redesign” modes may extend this pipeline; stay within current schema and export constraints unless specified.
`.trim();

/** Appended to planner / section-regeneration system context. */
export function buildSiteBuilderAssistantContractAppendix(): string {
  const registryKeys = listRegistryKeys().sort().join(", ");
  const blockTypes = BLOCK_TYPES.join(", ");
  return `
SITE BUILDER CONTRACT (authoritative):
- Output site documents MUST validate against SiteSchemaDocument: { pages: [{ slug, blocks }], metadata? }.
- Each page has slug (e.g. "/") and up to 200 blocks.
- Block shape: { type: <blockType>, content?: object, src?: string, href?: string, items?: string[] } plus passthrough fields.
- Supported block types: ${blockTypes}.
- For AI-generated sections, each block content SHOULD include aiSectionId (stable string) and aiRegistryKey (one of the registry keys below) so Refine can target and rebuild sections.
- Registry keys (sectionPlan.registryKey MUST be one of these): ${registryKeys}.

${REGISTRY_COMPOSITION_RULES}

${BLOCK_TEMPLATES}

- metadata.theme: backgroundMode, gradientStart/End, styleMode (web3|corporate|minimal|bold), optional media.
- metadata.designSystem: persisted tokens (colors, typography, spacing, motion) — edit via refinement or token instructions; do not invent token paths outside DesignSystemSchema.
- metadata.siteBuilderAssets: uploaded asset ids → urls for export bundling.
- metadata.siteImport: provenance, extractionNotes, reconstruction signals — honor IMPORT → IMPROVE rules above.
- metadata.widgetIntegration: optional Agency widget embed (widgetKey, placement).
- Consultant → client lifecycle (when a hub client is linked): optional metadata.clientPortal { enabled, clientId uuid, portalUrl, inviteStatus, showLoginLinkOnSite }, metadata.leadCapture { crmEnabled, clientHubEnabled, portalVisible, clientId }, metadata.aiAgent { agentId, widgetKey, status?, clientId? }; keep widgetIntegration as the embed source of truth.
- clientSiteBuild may be set when building for a linked client; public static export must strip client ids and portal details unless showLoginLinkOnSite is explicitly enabled.
- Export/static bundle: JSON-driven blocks only; builder preview does not execute arbitrary third-party scripts.
- Do not invent block types, metadata namespaces, or registry keys outside the lists above.

${IMPORT_TRANSFORM_RULES}

${FUTURE_HOOKS}
`.trim();
}
