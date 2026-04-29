import { buildDeploymentProjectFromSchema } from "@/lib/site-builder/project-export/orchestrate";
import {
  DesignSystemSchema,
  designSystemFromThemeSnapshot,
  hydrateDesignSystemBindingsOnDocument,
} from "@/lib/site-builder/design-system";
import { regenerateSection, type SessionEditContext } from "@/lib/site-builder/ai/regenerate-section";
import type { LlmMessage } from "@/lib/npc/llm";
import { hasNonemptyTarget, resolveSectionTarget } from "@/lib/site-builder/builder-actions/resolve-section-target";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { aiAgentSiteBindings, aiAgents } from "@/lib/db/schema";
import { mergeClientLifecycleMetadataIntoDocument } from "@/lib/site-builder/client-lifecycle-metadata";
import { mergeWidgetIntegrationIntoSiteSchema } from "@/lib/site-builder/merge-widget-integration";
import { createOrUpdateDomainConnection } from "@/lib/site-builder/domain-connection-orchestrate";
import { domainConnectionRowToMetadata, mergeDomainConnectionIntoCurrentSiteVersion } from "@/lib/site-builder/domain-connection-schema-sync";
import { ensureSiteBuilderTables, ensureSiteDomainConnectionsTable, getOwnedSite } from "@/lib/site-builder/db";
import {
  SiteMetadataClientPortalSchema,
  SiteSchemaDocument,
  type SiteSchemaDocumentType,
} from "@/lib/site-builder/schema";
import { createPortalInviteForOperator } from "@/lib/revenue-os/client-portal-invite-service";
import { upsertAgentSiteWidgetBindingFromHttpBody } from "@/lib/widget/upsert-agent-site-widget-binding";
import { applySeoIntelligenceToDocument } from "@/lib/site-builder/seo/seo-intelligence";
import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import { blockTemplate, type BlockTemplateKey } from "@/lib/site-builder/builder-actions/block-templates";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import {
  analyzeImportedBlueprint,
  fetchRemoteHtmlForImport,
  finalizeImportedSiteDocument,
  htmlToImportBlueprint,
  importBlueprintToSiteSchema,
  type ImportConversionOptions,
} from "@/lib/site-builder/site-import";
import { normalizeSiteDocumentBlockTargeting } from "@/lib/site-builder/schema/ensure-block-targeting";
import {
  applySectionAccentToBlock,
  applySectionBackgroundToBlock,
  applySectionTextColorToBlock,
  findBlockByAiSectionId,
  mergeSectionStylePatch,
} from "@/lib/site-builder/builder-actions/section-style-apply";

export type BuilderActionResult = {
  action: string;
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
};

function findPageIndex(doc: SiteSchemaDocumentType, slug: string): number {
  const i = doc.pages.findIndex((p) => p.slug === slug);
  return i;
}

function ensureMetadata(doc: SiteSchemaDocumentType): NonNullable<SiteSchemaDocumentType["metadata"]> {
  if (!doc.metadata) {
    doc.metadata = { title: "Site", governance: {} };
  }
  if (!doc.metadata.title?.trim()) {
    doc.metadata.title = "Site";
  }
  if (doc.metadata.governance === undefined) {
    doc.metadata.governance = {};
  }
  return doc.metadata;
}

function applyContentPatch(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  patch: Record<string, unknown> | undefined,
): void {
  if (!patch) return;
  if (block.type === "image" && typeof patch.src === "string") {
    block.src = patch.src;
  }
  const content = (block.content || {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "src" && block.type === "image") continue;
    if (v !== undefined) content[k] = v;
  }
  block.content = content;
}

function htmlToFinalDocument(
  html: string,
  sourceUrl: string,
  opts: ImportConversionOptions,
): SiteSchemaDocumentType {
  const raw = htmlToImportBlueprint(html, sourceUrl, sourceUrl);
  const analyzed = analyzeImportedBlueprint(raw);
  let schema = importBlueprintToSiteSchema(analyzed, opts);
  schema = finalizeImportedSiteDocument(schema);
  return SiteSchemaDocument.parse(schema);
}

export async function executeBuilderActions(input: {
  schemaJson: unknown;
  actions: BuilderAction[];
  /** Used for export_project_validate only. */
  userId?: number | null;
  /** When set, attach_agent_to_client_site can bind to this site (must match schema ownership). */
  siteId?: string | null;
  sessionEditContext?: SessionEditContext;
  /** When set, regenerate_section uses this invoker (BYOK / managed) instead of default global LLM. */
  invokeLlm?: (messages: LlmMessage[]) => Promise<string | null>;
  /** When false, stop on first failing action (default). When true, continue and accumulate failures. */
  continueOnError?: boolean;
}): Promise<{
  schema: SiteSchemaDocumentType;
  results: BuilderActionResult[];
  sessionEditContext?: SessionEditContext;
  abortedAt?: number;
}> {
  const parsed = SiteSchemaDocument.safeParse(input.schemaJson);
  if (!parsed.success) {
    throw new Error(`Invalid site schema: ${parsed.error.message}`);
  }

  let doc: SiteSchemaDocumentType = structuredClone(parsed.data) as SiteSchemaDocumentType;
  normalizeSiteDocumentBlockTargeting(doc);
  const results: BuilderActionResult[] = [];
  let session = input.sessionEditContext;
  const continueOnError = Boolean(input.continueOnError);

  for (let i = 0; i < input.actions.length; i++) {
    const act = input.actions[i]!;
    try {
      switch (act.action) {
        case "validate_schema": {
          SiteSchemaDocument.parse(doc);
          results.push({ action: act.action, ok: true, details: { pages: doc.pages.length } });
          break;
        }
        case "create_page": {
          ensureMetadata(doc);
          if (findPageIndex(doc, act.slug) !== -1) {
            throw new Error(`Page slug already exists: ${act.slug}`);
          }
          let blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [];
          if (act.duplicateBlocksFromSlug) {
            const srcIdx = findPageIndex(doc, act.duplicateBlocksFromSlug);
            if (srcIdx === -1) throw new Error(`duplicateBlocksFromSlug not found: ${act.duplicateBlocksFromSlug}`);
            blocks = structuredClone(doc.pages[srcIdx]!.blocks) as typeof blocks;
          }
          doc.pages.push({
            slug: act.slug,
            blocks,
          });
          results.push({ action: act.action, ok: true, details: { slug: act.slug, blockCount: blocks.length } });
          break;
        }
        case "update_page_metadata": {
          const m = ensureMetadata(doc);
          if (act.title !== undefined) m.title = act.title;
          if (act.description !== undefined) m.description = act.description;
          if (act.keywords !== undefined) m.keywords = act.keywords;
          if (act.canonicalUrl !== undefined) m.canonicalUrl = act.canonicalUrl;
          if (act.robots !== undefined) m.robots = act.robots;
          results.push({ action: act.action, ok: true });
          break;
        }
        case "apply_seo_enrichment": {
          const m = ensureMetadata(doc);
          const basePrompt = [m.title, m.description, m.seoPrimaryKeyword, act.focusPrompt].filter(Boolean).join(". ");
          const input: SitePlannerInput = {
            userPrompt: basePrompt.slice(0, 8000),
            siteType: "auto",
            styleIntensity: 55,
            web3VisualMode: false,
          };
          applySeoIntelligenceToDocument(doc, input);
          hydrateDesignSystemBindingsOnDocument(doc);
          results.push({ action: act.action, ok: true });
          break;
        }
        case "add_section": {
          const pi = findPageIndex(doc, act.pageSlug);
          if (pi === -1) throw new Error(`Page not found: ${act.pageSlug}`);
          const page = doc.pages[pi]!;
          const block = blockTemplate(act.template as BlockTemplateKey);
          applyContentPatch(block, act.contentPatch);
          const idx = act.index === undefined ? page.blocks.length : Math.min(act.index, page.blocks.length);
          page.blocks.splice(idx, 0, block);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, index: idx, type: block.type },
          });
          break;
        }
        case "remove_section": {
          let ridx = -1;
          let slugForResult = act.pageSlug;
          if (hasNonemptyTarget(act.target)) {
            const merged = { ...act.target, pageSlug: act.target.pageSlug ?? act.pageSlug };
            const r = resolveSectionTarget(doc, merged);
            ridx = r.blockIndex;
            slugForResult = r.pageSlug;
          } else {
            const pi = findPageIndex(doc, act.pageSlug);
            if (pi === -1) throw new Error(`Page not found: ${act.pageSlug}`);
            const page = doc.pages[pi]!;
            if (act.index !== undefined) {
              ridx = act.index;
            } else if (act.aiSectionId) {
              ridx = page.blocks.findIndex((b) => {
                const c = b.content as { aiSectionId?: string } | undefined;
                return c && String(c.aiSectionId) === act.aiSectionId;
              });
            }
          }
          if (ridx < 0) throw new Error("remove_section: invalid target index");
          const pi2 = findPageIndex(doc, slugForResult);
          if (pi2 === -1) throw new Error(`Page not found: ${slugForResult}`);
          const page2 = doc.pages[pi2]!;
          if (ridx >= page2.blocks.length) throw new Error("remove_section: invalid target index");
          page2.blocks.splice(ridx, 1);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: slugForResult, removedIndex: ridx },
          });
          break;
        }
        case "move_section": {
          const pi = findPageIndex(doc, act.pageSlug);
          if (pi === -1) throw new Error(`Page not found: ${act.pageSlug}`);
          const page = doc.pages[pi]!;
          const { fromIndex, toIndex } = act;
          if (fromIndex < 0 || fromIndex >= page.blocks.length) throw new Error("move_section: bad fromIndex");
          const clampedTo = Math.max(0, Math.min(toIndex, page.blocks.length - 1));
          const [item] = page.blocks.splice(fromIndex, 1);
          if (!item) throw new Error("move_section: empty splice");
          page.blocks.splice(clampedTo, 0, item);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, fromIndex, toIndex: clampedTo },
          });
          break;
        }
        case "update_copy": {
          let aiSid = act.aiSectionId?.trim() || "";
          let resolvedDetail: Record<string, unknown> | undefined;
          const pageSlugForCopy =
            hasNonemptyTarget(act.target) && act.target ? (act.target.pageSlug ?? act.pageSlug) : act.pageSlug;
          if (hasNonemptyTarget(act.target)) {
            const merged = { ...act.target, pageSlug: pageSlugForCopy };
            const r = resolveSectionTarget(doc, merged);
            aiSid = r.aiSectionId;
            resolvedDetail = { resolvedTarget: r };
          }
          const pi = findPageIndex(doc, pageSlugForCopy);
          if (pi === -1) throw new Error(`Page not found: ${pageSlugForCopy}`);
          const page = doc.pages[pi]!;
          const block = page.blocks.find((b) => {
            const c = b.content as { aiSectionId?: string } | undefined;
            return c && String(c.aiSectionId) === aiSid;
          });
          if (!block) throw new Error(`No block with aiSectionId ${aiSid}`);
          const c = (block.content || {}) as Record<string, unknown>;
          const { patches } = act;
          if (patches.title !== undefined) c.title = patches.title;
          if (patches.subtitle !== undefined) c.subtitle = patches.subtitle;
          if (patches.body !== undefined) c.body = patches.body;
          if (patches.text !== undefined) c.text = patches.text;
          if (patches.label !== undefined) c.label = patches.label;
          block.content = c;
          results.push({
            action: act.action,
            ok: true,
            details: { aiSectionId: aiSid, ...resolvedDetail },
          });
          break;
        }
        case "set_section_background": {
          const hit = findBlockByAiSectionId(doc, act.pageSlug, act.sectionId);
          if (!hit) throw new Error(`set_section_background: no block with aiSectionId ${act.sectionId}`);
          applySectionBackgroundToBlock(hit.block, act.color);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, sectionId: act.sectionId },
          });
          break;
        }
        case "set_section_text_color": {
          const hit = findBlockByAiSectionId(doc, act.pageSlug, act.sectionId);
          if (!hit) throw new Error(`set_section_text_color: no block with aiSectionId ${act.sectionId}`);
          applySectionTextColorToBlock(hit.block, act.color);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, sectionId: act.sectionId },
          });
          break;
        }
        case "set_section_accent_color": {
          const hit = findBlockByAiSectionId(doc, act.pageSlug, act.sectionId);
          if (!hit) throw new Error(`set_section_accent_color: no block with aiSectionId ${act.sectionId}`);
          applySectionAccentToBlock(hit.block, act.color);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, sectionId: act.sectionId },
          });
          break;
        }
        case "update_section_style": {
          const hit = findBlockByAiSectionId(doc, act.pageSlug, act.sectionId);
          if (!hit) throw new Error(`update_section_style: no block with aiSectionId ${act.sectionId}`);
          mergeSectionStylePatch(hit.block, act.stylePatch as Record<string, unknown>);
          results.push({
            action: act.action,
            ok: true,
            details: { pageSlug: act.pageSlug, sectionId: act.sectionId, keys: Object.keys(act.stylePatch) },
          });
          break;
        }
        case "set_theme_tokens": {
          const m = ensureMetadata(doc);
          m.theme = {
            ...(m.theme ?? {}),
            ...(act.styleMode !== undefined ? { styleMode: act.styleMode } : {}),
            ...(act.gradientStart !== undefined ? { gradientStart: act.gradientStart } : {}),
            ...(act.gradientEnd !== undefined ? { gradientEnd: act.gradientEnd } : {}),
            ...(act.backgroundColor !== undefined ? { backgroundColor: act.backgroundColor.slice(0, 40) } : {}),
            ...(act.backgroundMode !== undefined ? { backgroundMode: act.backgroundMode } : {}),
            ...(act.gradientStyle !== undefined ? { gradientStyle: act.gradientStyle } : {}),
            ...(act.buttonStyle !== undefined ? { buttonStyle: act.buttonStyle } : {}),
            ...(act.depthStyle !== undefined ? { depthStyle: act.depthStyle } : {}),
            ...(act.motionHint !== undefined ? { motionHint: act.motionHint } : {}),
          };
          const theme = m.theme;
          let ds = designSystemFromThemeSnapshot({
            styleMode: theme.styleMode,
            gradientStart: theme.gradientStart,
            gradientEnd: theme.gradientEnd,
          });
          if (act.accent !== undefined) {
            const a = act.accent.slice(0, 80);
            ds = DesignSystemSchema.parse({
              ...ds,
              colors: { ...ds.colors, accent: a, primary: a },
            });
          }
          const bgMode = String(theme.backgroundMode || "");
          const bgColor = String(theme.backgroundColor || "").trim().toLowerCase();
          const looksLightSurface =
            bgMode === "custom_color" &&
            (bgColor === "#ffffff" ||
              bgColor === "#fff" ||
              bgColor === "white" ||
              /^#f[a-f0-9]{5}$/i.test(bgColor) ||
              /^#f[a-f0-9]{2}f[a-f0-9]{2}f[a-f0-9]{2}$/i.test(bgColor));
          if (looksLightSurface) {
            ds = DesignSystemSchema.parse({
              ...ds,
              colors: {
                ...ds.colors,
                background: theme.backgroundColor?.slice(0, 40) || "#ffffff",
                surface: "#f8fafc",
                surfaceElevated: "#f1f5f9",
                text: "#0f172a",
                textMuted: "#475569",
                border: "rgba(15,23,42,0.12)",
              },
            });
          }
          m.designSystem = ds;
          hydrateDesignSystemBindingsOnDocument(doc);
          results.push({ action: act.action, ok: true });
          break;
        }
        case "set_footer": {
          const pi = findPageIndex(doc, act.pageSlug);
          if (pi === -1) throw new Error(`Page not found: ${act.pageSlug}`);
          const page = doc.pages[pi]!;
          const footerIdx = page.blocks.findIndex((b) => b.type === "footer");
          if (footerIdx !== -1 && act.mode === "replace_first") {
            const c = (page.blocks[footerIdx]!.content || {}) as Record<string, unknown>;
            c.body = act.body;
            page.blocks[footerIdx]!.content = c;
          } else {
            const b = blockTemplate("footer");
            const c = (b.content || {}) as Record<string, unknown>;
            c.body = act.body;
            b.content = c;
            page.blocks.push(b);
          }
          results.push({ action: act.action, ok: true, details: { pageSlug: act.pageSlug } });
          break;
        }
        case "set_nav_text_block": {
          const pi = findPageIndex(doc, act.pageSlug);
          if (pi === -1) throw new Error(`Page not found: ${act.pageSlug}`);
          const page = doc.pages[pi]!;
          const text = act.lines.join("\n").slice(0, 12000);
          const b = blockTemplate("paragraph");
          const c = (b.content || {}) as Record<string, unknown>;
          c.text = `Nav / links:\n${text}`;
          b.content = c;
          if (act.position === "top") page.blocks.unshift(b);
          else page.blocks.push(b);
          results.push({ action: act.action, ok: true, details: { pageSlug: act.pageSlug, position: act.position } });
          break;
        }
        case "normalize_imported_markup": {
          const raw = htmlToImportBlueprint(act.html, act.sourceUrl, act.sourceUrl);
          const analyzed = analyzeImportedBlueprint(raw);
          results.push({
            action: act.action,
            ok: true,
            details: {
              sectionCount: analyzed.sections.length,
              reconstructionPath: analyzed.reconstruction?.path,
              partial: Boolean(analyzed.partial),
            },
          });
          break;
        }
        case "map_html_to_schema": {
          doc = htmlToFinalDocument(act.html, act.sourceUrl, {});
          hydrateDesignSystemBindingsOnDocument(doc);
          results.push({
            action: act.action,
            ok: true,
            details: {
              pages: doc.pages.length,
              homeBlocks: doc.pages[0]?.blocks.length ?? 0,
            },
          });
          break;
        }
        case "map_import_to_builder_schema": {
          const opts: ImportConversionOptions = {
            widgetKey: act.widgetKey?.trim(),
            loaderOrigin: act.loaderOrigin?.trim(),
            widgetPlacement: act.widgetPlacement ?? "body_end",
          };
          doc = htmlToFinalDocument(act.html, act.sourceUrl, opts);
          hydrateDesignSystemBindingsOnDocument(doc);
          results.push({
            action: act.action,
            ok: true,
            details: {
              pages: doc.pages.length,
              homeBlocks: doc.pages[0]?.blocks.length ?? 0,
            },
          });
          break;
        }
        case "import_blueprint_from_url": {
          const fetched = await fetchRemoteHtmlForImport(act.url);
          if (!fetched.ok) {
            throw new Error(fetched.message || fetched.code || "fetch failed");
          }
          const opts: ImportConversionOptions = {
            widgetKey: act.widgetKey?.trim(),
            loaderOrigin: act.loaderOrigin?.trim(),
            widgetPlacement: act.widgetPlacement ?? "body_end",
          };
          doc = htmlToFinalDocument(fetched.html, fetched.url, opts);
          hydrateDesignSystemBindingsOnDocument(doc);
          results.push({
            action: act.action,
            ok: true,
            details: {
              finalUrl: fetched.finalUrl,
              pages: doc.pages.length,
              homeBlocks: doc.pages[0]?.blocks.length ?? 0,
            },
          });
          break;
        }
        case "regenerate_section": {
          let sectionId = act.sectionId?.trim() || "";
          let resolvedDetail: Record<string, unknown> | undefined;
          if (hasNonemptyTarget(act.target)) {
            const r = resolveSectionTarget(doc, act.target);
            sectionId = r.aiSectionId;
            resolvedDetail = { resolvedTarget: r };
          }
          const regen = await regenerateSection({
            schemaJson: doc,
            sectionId,
            instruction: act.instruction,
            partialInput: act.input,
            sessionEditContext: session,
            invokeLlm: input.invokeLlm,
          });
          doc = regen.schema;
          session = regen.sessionEditContext;
          results.push({
            action: act.action,
            ok: true,
            details: {
              sectionId,
              pageIndex: regen.pageIndex,
              replacedIndex: regen.replacedIndex,
              registryKey: regen.registryKey,
              ...resolvedDetail,
            },
          });
          break;
        }
        case "export_project_validate": {
          await buildDeploymentProjectFromSchema(doc, { userId: input.userId ?? null });
          results.push({ action: act.action, ok: true });
          break;
        }
        case "save_project": {
          results.push({
            action: act.action,
            ok: true,
            message:
              "Acknowledged. Persist schemaJson via site version API from the client; server does not write versions here.",
            details: act.note ? { note: act.note } : undefined,
          });
          break;
        }
        case "render_preview_ack": {
          results.push({
            action: act.action,
            ok: true,
            message: "Re-render preview from returned schemaJson in the builder shell.",
            details: act.note ? { note: act.note } : undefined,
          });
          break;
        }
        case "prepare_client_portal": {
          const siteCid = act.siteClientId?.trim() || doc.metadata?.clientId?.trim() || null;
          doc = mergeClientLifecycleMetadataIntoDocument(doc, {
            buildForClient: Boolean(act.buildForClient),
            siteClientId: siteCid,
            agencyBindings: [],
          });
          results.push({
            action: act.action,
            ok: true,
            message: "Client portal metadata synced on the draft.",
            details: { clientId: siteCid },
          });
          break;
        }
        case "open_client_command_center": {
          const hubUrl = `/ai-revenue-os/clients/${encodeURIComponent(act.clientId)}`;
          results.push({
            action: act.action,
            ok: true,
            message: `Client command center: open ${hubUrl} in this app (new tab recommended).`,
            details: { hubUrl, portalUrl: `/ai-revenue-os/clients/${act.clientId}/portal` },
          });
          break;
        }
        case "invite_client_to_portal": {
          if (!input.userId) {
            throw new Error("invite_client_to_portal requires authenticated userId");
          }
          if (!act.confirmed) {
            results.push({
              action: act.action,
              ok: true,
              message:
                "Invite not sent — set confirmed:true only after you verify the client email in Client Hub → Client portal. You can also send from there.",
              details: { needsConfirmation: true, clientId: act.clientId, email: act.email },
            });
            break;
          }
          const db = await getDb();
          const inv = await createPortalInviteForOperator(db, input.userId, act.clientId, act.email, act.role);
          if (!inv.ok) {
            throw new Error(inv.error);
          }
          const m = ensureMetadata(doc);
          const prev = (m.clientPortal ?? {}) as Record<string, unknown>;
          m.clientPortal = SiteMetadataClientPortalSchema.parse({
            enabled: true,
            clientId: act.clientId,
            portalUrl: typeof prev.portalUrl === "string" ? prev.portalUrl : "/client-portal",
            inviteStatus: "invited",
            showLoginLinkOnSite: Boolean(prev.showLoginLinkOnSite),
          });
          results.push({
            action: act.action,
            ok: true,
            message: `Invite created. Share once: ${inv.inviteLink}`,
            details: { inviteId: inv.inviteId, expiresAt: inv.expiresAt },
          });
          break;
        }
        case "attach_agent_to_client_site": {
          if (!input.siteId?.trim()) {
            throw new Error("attach_agent_to_client_site requires siteId on the builder-actions request");
          }
          if (!input.userId) {
            throw new Error("attach_agent_to_client_site requires authenticated userId");
          }
          const db = await getDb();
          await ensureAgentTables();
          await ensureClientHubTables();
          const site = await getOwnedSite(db, input.userId, input.siteId.trim());
          if (!site) {
            throw new Error("Site not found");
          }
          const body: Record<string, unknown> = {
            siteId: site.id,
            ...(act.clientId ? { clientId: act.clientId } : {}),
            widgetAppearance: {
              avatarShape: "circle",
              ...(act.avatarBorderColor ? { avatarBorderColor: act.avatarBorderColor } : {}),
              ...(act.widgetBubbleColor ? { widgetBubbleColor: act.widgetBubbleColor } : {}),
              ...(act.widgetHeaderColor ? { widgetHeaderColor: act.widgetHeaderColor } : {}),
              ...(act.widgetWindowBackgroundColor
                ? { widgetWindowBackgroundColor: act.widgetWindowBackgroundColor }
                : {}),
            },
          };
          const { widgetKey } = await upsertAgentSiteWidgetBindingFromHttpBody(db, input.userId, act.agentId, body);
          const [bindRow] = await db
            .select({
              agentId: aiAgentSiteBindings.agentId,
              widgetKey: aiAgentSiteBindings.widgetKey,
              clientId: aiAgentSiteBindings.clientId,
              isActive: aiAgentSiteBindings.isActive,
              agentStatus: aiAgents.status,
            })
            .from(aiAgentSiteBindings)
            .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
            .where(and(eq(aiAgentSiteBindings.siteId, site.id), eq(aiAgentSiteBindings.agentId, act.agentId)))
            .limit(1);
          if (act.mergeWidgetIntoSchema !== false) {
            const merged = mergeWidgetIntegrationIntoSiteSchema(doc, { widgetKey });
            if (!merged.ok) {
              throw new Error(merged.error);
            }
            doc = merged.schema;
          }
          doc = mergeClientLifecycleMetadataIntoDocument(doc, {
            buildForClient: Boolean(site.clientId),
            siteClientId: site.clientId ?? act.clientId ?? null,
            agencyBindings: bindRow
              ? [
                  {
                    agentId: bindRow.agentId,
                    widgetKey: bindRow.widgetKey,
                    agentStatus: bindRow.agentStatus,
                    clientId: bindRow.clientId,
                    isActive: Boolean(bindRow.isActive),
                  },
                ]
              : [],
          });
          results.push({
            action: act.action,
            ok: true,
            message: "Agent bound to site; schema metadata updated where applicable.",
            details: { widgetKey, agentId: act.agentId },
          });
          break;
        }
        case "mark_client_portal_invite_sent": {
          const m = ensureMetadata(doc);
          const cid = m.clientId?.trim();
          if (!cid) {
            throw new Error("metadata.clientId required before marking portal invite sent");
          }
          const prev = (m.clientPortal ?? {}) as Record<string, unknown>;
          m.clientPortal = SiteMetadataClientPortalSchema.parse({
            enabled: true,
            clientId: cid,
            portalUrl: typeof prev.portalUrl === "string" ? prev.portalUrl : "/client-portal",
            inviteStatus: "invited",
            showLoginLinkOnSite: Boolean(prev.showLoginLinkOnSite),
          });
          results.push({ action: act.action, ok: true });
          break;
        }
        case "mark_client_portal_active": {
          const m = ensureMetadata(doc);
          const cid = m.clientId?.trim();
          if (!cid) {
            throw new Error("metadata.clientId required before marking portal active");
          }
          const prev = (m.clientPortal ?? {}) as Record<string, unknown>;
          m.clientPortal = SiteMetadataClientPortalSchema.parse({
            enabled: true,
            clientId: cid,
            portalUrl: typeof prev.portalUrl === "string" ? prev.portalUrl : "/client-portal",
            inviteStatus: "active",
            showLoginLinkOnSite: Boolean(prev.showLoginLinkOnSite),
          });
          results.push({ action: act.action, ok: true });
          break;
        }
        case "upsert_domain_connection": {
          if (!input.userId) {
            throw new Error("upsert_domain_connection requires authenticated userId");
          }
          if (!input.siteId?.trim()) {
            throw new Error("upsert_domain_connection requires siteId on the request");
          }
          const db = await getDb();
          await ensureSiteBuilderTables(db);
          await ensureSiteDomainConnectionsTable(db);
          const site = await getOwnedSite(db, input.userId, input.siteId.trim());
          if (!site) {
            throw new Error("Site not found");
          }
          const siteClientId = site.clientId != null && String(site.clientId).trim() ? String(site.clientId).trim() : null;
          const { row } = await createOrUpdateDomainConnection({
            db,
            ownerUserId: input.userId,
            siteId: site.id,
            siteClientId,
            domain: act.domain,
            domainType: act.domainType,
            providerHint: act.provider,
            deploymentTarget: act.deploymentTarget,
            targetUrlRaw: act.targetUrl,
          });
          await mergeDomainConnectionIntoCurrentSiteVersion(db, input.userId, site.id, row);
          const m = ensureMetadata(doc);
          m.domainConnection = domainConnectionRowToMetadata(row);
          results.push({
            action: act.action,
            ok: true,
            message:
              "Domain connection saved on the project. Open Connect Domain in the builder to copy setup steps and re-check DNS.",
            details: { connectionId: row.id, status: row.status, domain: row.domain },
          });
          break;
        }
      }

      normalizeSiteDocumentBlockTargeting(doc);
      doc = SiteSchemaDocument.parse(doc);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Action failed";
      results.push({ action: act.action, ok: false, message });
      if (!continueOnError) {
        return { schema: doc, results, sessionEditContext: session, abortedAt: i };
      }
    }
  }

  normalizeSiteDocumentBlockTargeting(doc);
  hydrateDesignSystemBindingsOnDocument(doc);
  return { schema: SiteSchemaDocument.parse(doc), results, sessionEditContext: session };
}
