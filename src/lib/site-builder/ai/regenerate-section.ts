import { getRegistryEntry } from "@/lib/site-builder/ai/block-registry";
import { runSitePlanner, type RunSitePlannerOptions } from "@/lib/site-builder/ai/planner";
import type { LlmMessage } from "@/lib/npc/llm";
import { resolveImportRegistryKey } from "@/lib/site-builder/site-import/import-registry-aliases";
import type { SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { applyLayoutRestructureHeuristic } from "@/lib/site-builder/ai/layout-restructure-heuristic";
import {
  applySessionBiasToScope,
  buildRegenerationPlannerPrompt,
  classifyBatchEditIntents,
  classifyEditIntents,
  mergeSessionAfterBatchEdit,
  mergeSessionAfterEdit,
  primaryIntent,
  resolveBatchEditScope,
  resolveEditScope,
  resolveRegistrySwap,
  shouldApplyLayoutRestructureHeuristic,
  shouldRegenerateNeighbors,
  type BatchEditIntent,
  type EditIntent,
  type EditScope,
  type SectionEditMeta,
  type SessionEditContext,
} from "@/lib/site-builder/ai/section-edit-intelligence";
import { applyTroothertzVisualPostProcessToDocument, styleModeFromSiteDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { applyBrandBrainAfterTroothertz } from "@/lib/site-builder/brand-brain-pipeline";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { applyGlobalDesignTokenInstruction } from "@/lib/site-builder/token-edit-intelligence";

export type { SessionEditContext, SectionEditMeta };

export type BatchRegenerateMeta = {
  batchIntents: BatchEditIntent[];
  scope: EditScope;
  layoutRestructureApplied: boolean;
  layoutRestructureKind?: string;
  sectionIds: string[];
  singleEditMetaSummaries: Array<{ sectionId: string; primaryIntent: EditIntent; registrySwapped: boolean }>;
};

type BlockT = SiteSchemaDocumentType["pages"][number]["blocks"][number];

function maybeApplyDocumentPostProcess(
  doc: SiteSchemaDocumentType,
  sourceForStyle: SiteSchemaDocumentType,
  defer?: boolean,
): void {
  if (!defer) {
    applyTroothertzVisualPostProcessToDocument(doc, styleModeFromSiteDocument(sourceForStyle));
    applyBrandBrainAfterTroothertz(doc, sourceForStyle, "mixed");
  }
}

function findBlockLocation(
  doc: SiteSchemaDocumentType,
  sectionId: string,
): { pageIndex: number; blockIndex: number } | null {
  for (let pi = 0; pi < doc.pages.length; pi++) {
    const page = doc.pages[pi]!;
    const idx = page.blocks.findIndex((b) => {
      const c = b.content as Record<string, unknown> | undefined;
      return c && String(c.aiSectionId || "") === sectionId;
    });
    if (idx !== -1) return { pageIndex: pi, blockIndex: idx };
  }
  return null;
}

function rebuildBlockWithPlanner(
  block: BlockT,
  planner: SitePlannerOutput,
  seedPrefix: string,
  forceRegistryKey?: string,
): { next: BlockT; rebuilt: boolean } {
  const c = (block.content || {}) as Record<string, unknown>;
  const rkRaw = (forceRegistryKey ?? String(c.aiRegistryKey || "")).trim();
  const rk = resolveImportRegistryKey(rkRaw);
  const sid = String(c.aiSectionId || "").trim();
  if (!rk || !sid) return { next: block, rebuilt: false };
  const r = getRegistryEntry(rk);
  if (!r) return { next: block, rebuilt: false };
  let next = r.build({
    planner,
    sectionId: sid,
    seed: `${seedPrefix}:${sid}:${rk}:${Date.now()}`,
  });
  if (block.type === "image" && next.type === "image") {
    const prevRec = block as { src?: string; content?: Record<string, unknown> };
    const nextRec = next as { src?: string; content?: Record<string, unknown> };
    const prevSrc = typeof prevRec.src === "string" ? prevRec.src.trim() : "";
    const nextSrc = typeof nextRec.src === "string" ? nextRec.src.trim() : "";
    const mergedContent = {
      ...(typeof prevRec.content === "object" && prevRec.content ? prevRec.content : {}),
      ...(typeof nextRec.content === "object" && nextRec.content ? nextRec.content : {}),
    };
    if (prevSrc && !nextSrc) nextRec.src = prevSrc;
    const pAlt = prevRec.content?.alt;
    const nAlt = mergedContent.alt;
    const placeholderAlt =
      !nAlt ||
      String(nAlt).includes("Imported visual") ||
      String(nAlt).includes("Key image") ||
      String(nAlt).includes("Brand frame");
    if (pAlt && placeholderAlt) mergedContent.alt = pAlt;
    mergedContent.aiSectionId = sid;
    mergedContent.aiRegistryKey = "image_spotlight";
    nextRec.content = mergedContent;
    next = nextRec as BlockT;
  }
  return { next, rebuilt: true };
}

export type RegenerateSectionResult = {
  schema: SiteSchemaDocumentType;
  replacedIndex: number;
  pageIndex: number;
  registryKey: string;
  editMeta: SectionEditMeta;
  sessionEditContext: SessionEditContext;
};

/**
 * Regenerates one block (matched by `content.aiSectionId`), with adaptive intent/scope and optional registry swap.
 * Re-runs Troothertz post-process on the full document for rhythm/continuity coherence.
 */
export async function regenerateSection(params: {
  schemaJson: unknown;
  sectionId: string;
  instruction?: string;
  partialInput?: Partial<SitePlannerInput>;
  sessionEditContext?: SessionEditContext;
  /** When true, skip Troothertz post-process (caller runs once after batch). */
  deferDocumentPostProcess?: boolean;
  /** When true, skip adjacent block refresh (batch + final post-process instead). */
  suppressNeighborRegeneration?: boolean;
  /**
   * Site-scoped LLM invoker; pass `{ invokeLlm: null }` to force deterministic planner only.
   * Omitted = legacy global `NPC_LLM_*` behavior inside `runSitePlanner`.
   */
  invokeLlm?: ((messages: LlmMessage[]) => Promise<string | null>) | null;
}): Promise<RegenerateSectionResult> {
  const parsed = SiteSchemaDocument.safeParse(params.schemaJson);
  if (!parsed.success) {
    throw new Error("Invalid site schema");
  }
  const doc = parsed.data;
  const plannerOpts: RunSitePlannerOptions | undefined = Object.prototype.hasOwnProperty.call(params, "invokeLlm")
    ? { invokeLlm: params.invokeLlm ?? null }
    : undefined;
  const deferPost = Boolean(params.deferDocumentPostProcess);
  const skipNeighbors = Boolean(params.suppressNeighborRegeneration);
  const loc = findBlockLocation(doc, params.sectionId);
  if (!loc) {
    throw new Error(`No block with aiSectionId "${params.sectionId}"`);
  }

  const { pageIndex, blockIndex: idx } = loc;
  const page = doc.pages[pageIndex]!;
  const prev = page.blocks[idx]!;
  const content = (prev.content || {}) as Record<string, unknown>;
  let registryKey = resolveImportRegistryKey(String(content.aiRegistryKey || "").trim());
  if (!registryKey) {
    throw new Error("Block is missing content.aiRegistryKey — run AI generation first or set registry key manually.");
  }

  const instruction = params.instruction?.trim() || "";
  if (instruction) {
    const tokenResult = applyGlobalDesignTokenInstruction(doc, instruction);
    if (tokenResult.applied) {
      maybeApplyDocumentPostProcess(doc, doc, deferPost);
      const editMeta: SectionEditMeta = {
        intents: ["design_token_update"],
        scope: "route_level",
        registrySwapped: false,
        neighborBlocksUpdated: 0,
        primaryIntent: "design_token_update",
        designTokenKinds: tokenResult.kinds,
        brandGovernanceApplied: true,
      };
      const sessionEditContext = mergeSessionAfterEdit(
        params.sessionEditContext,
        params.sectionId,
        { intents: editMeta.intents, scope: editMeta.scope, registrySwapped: false },
        instruction,
      );
      return {
        schema: SiteSchemaDocument.parse(doc),
        replacedIndex: idx,
        pageIndex,
        registryKey,
        editMeta,
        sessionEditContext,
      };
    }
  }
  const intents = classifyEditIntents(instruction);
  let scope: EditScope = resolveEditScope(intents, instruction);
  scope = applySessionBiasToScope(scope, intents, params.sessionEditContext);

  const swapTo = resolveRegistrySwap(registryKey, instruction);
  let registrySwapped = false;
  if (swapTo && getRegistryEntry(swapTo)) {
    registryKey = swapTo;
    registrySwapped = true;
  }

  const reg = getRegistryEntry(registryKey);
  if (!reg) {
    throw new Error(`Unknown registry key: ${registryKey} (imported blocks should resolve via import aliases).`);
  }

  const plannerPrompt = buildRegenerationPlannerPrompt(doc, instruction || `Refresh section ${registryKey}`, params.sessionEditContext);
  const briefContext = [
    params.partialInput?.userPrompt,
    params.partialInput?.industry,
    params.partialInput?.market,
    params.partialInput?.businessName,
    params.partialInput?.primaryOffer,
    params.partialInput?.audience,
  ]
    .map((s) => (typeof s === "string" && s.trim() ? s.trim() : ""))
    .filter(Boolean);
  const mergedUserPrompt = briefContext.length
    ? `${plannerPrompt}\n\n— Site / intake brief —\n${briefContext.join("\n")}`.slice(0, 8000)
    : plannerPrompt;

  const input: SitePlannerInput = {
    userPrompt: mergedUserPrompt,
    siteType: params.partialInput?.siteType ?? "auto",
    designDirection: params.partialInput?.designDirection,
    styleIntensity: params.partialInput?.styleIntensity ?? 55,
    web3VisualMode: params.partialInput?.web3VisualMode ?? false,
  };

  const nextPagesBase = doc.pages.map((p, pi) => {
    if (pi !== pageIndex) return p;
    return { ...p, blocks: [...p.blocks] };
  });
  const targetPage = nextPagesBase[pageIndex]!;

  let neighborBlocksUpdated = 0;

  if (scope === "full_rebuild") {
    const widePrompt = `${plannerPrompt} Scope: coordinated refresh across every page. Keep route slugs and section order; align copy and rhythm site-wide.`.slice(
      0,
      8000,
    );
    const { output: cohesivePlanner } = await runSitePlanner({ ...input, userPrompt: widePrompt }, plannerOpts);
    let rebuiltCount = 0;
    const rebuiltPages = doc.pages.map((p, pi) => {
      const blocks = p.blocks.map((b, bi) => {
        const force = pi === pageIndex && bi === idx ? registryKey : undefined;
        const { next, rebuilt } = rebuildBlockWithPlanner(b, cohesivePlanner, `full:${pi}:${bi}`, force);
        if (rebuilt) rebuiltCount += 1;
        return next;
      });
      return { ...p, blocks };
    });
    neighborBlocksUpdated = Math.max(0, rebuiltCount - 1);
    const nextDoc: SiteSchemaDocumentType = { ...doc, pages: rebuiltPages };
    maybeApplyDocumentPostProcess(nextDoc, doc, deferPost);
    const editMeta: SectionEditMeta = {
      intents,
      scope,
      registrySwapped,
      neighborBlocksUpdated,
      primaryIntent: primaryIntent(intents),
    };
    const sessionEditContext = mergeSessionAfterEdit(
      params.sessionEditContext,
      params.sectionId,
      {
        intents: editMeta.intents,
        scope: editMeta.scope,
        registrySwapped: editMeta.registrySwapped,
      },
      instruction,
    );
    return {
      schema: SiteSchemaDocument.parse(nextDoc),
      replacedIndex: idx,
      pageIndex,
      registryKey,
      editMeta,
      sessionEditContext,
    };
  }

  if (scope === "route_level") {
    const routePrompt = `${plannerPrompt} Scope: full-page refresh on this route. Keep section order and roles; align sections coherently.`.slice(0, 8000);
    const { output: cohesivePlanner } = await runSitePlanner({ ...input, userPrompt: routePrompt }, plannerOpts);
    let rebuiltCount = 0;
    const blocks = targetPage.blocks.map((b, bi) => {
      const force = bi === idx ? registryKey : undefined;
      const { next, rebuilt } = rebuildBlockWithPlanner(b, cohesivePlanner, `route:${bi}`, force);
      if (rebuilt) rebuiltCount += 1;
      return next;
    });
    neighborBlocksUpdated = Math.max(0, rebuiltCount - 1);
    const nextPages = nextPagesBase.map((p, pi) => (pi === pageIndex ? { ...p, blocks } : p));
    const nextDoc: SiteSchemaDocumentType = { ...doc, pages: nextPages };
    maybeApplyDocumentPostProcess(nextDoc, doc, deferPost);
    const editMeta: SectionEditMeta = {
      intents,
      scope,
      registrySwapped,
      neighborBlocksUpdated,
      primaryIntent: primaryIntent(intents),
    };
    const sessionEditContext = mergeSessionAfterEdit(
      params.sessionEditContext,
      params.sectionId,
      {
        intents: editMeta.intents,
        scope: editMeta.scope,
        registrySwapped: editMeta.registrySwapped,
      },
      instruction,
    );
    return {
      schema: SiteSchemaDocument.parse(nextDoc),
      replacedIndex: idx,
      pageIndex,
      registryKey,
      editMeta,
      sessionEditContext,
    };
  }

  const { output: planner } = await runSitePlanner(input, plannerOpts);

  const { next: nextBlock, rebuilt: singleRebuilt } = rebuildBlockWithPlanner(prev, planner, "single", registryKey);
  if (!singleRebuilt) {
    throw new Error(`Could not rebuild section with registry key: ${registryKey}`);
  }

  targetPage.blocks[idx] = nextBlock;

  if (!skipNeighbors && shouldRegenerateNeighbors(intents, scope)) {
    const continuityPrompt = buildRegenerationPlannerPrompt(
      doc,
      `Continuity only: align the adjacent section with the updated neighbor. Do not change overall page story. Original request context: ${instruction.slice(0, 200)}`,
      params.sessionEditContext,
    );
    const neighborInput: SitePlannerInput = {
      ...input,
      userPrompt: continuityPrompt.slice(0, 8000),
    };
    const { output: neighborPlanner } = await runSitePlanner(neighborInput, plannerOpts);

    const refreshNeighbor = async (ni: number) => {
      if (ni < 0 || ni >= targetPage.blocks.length) return;
      const b = targetPage.blocks[ni]!;
      const { next, rebuilt } = rebuildBlockWithPlanner(b, neighborPlanner, `neighbor:${ni}`);
      if (!rebuilt) return;
      targetPage.blocks[ni] = next;
      neighborBlocksUpdated += 1;
    };

    await refreshNeighbor(idx - 1);
    await refreshNeighbor(idx + 1);
  }

  const nextDoc: SiteSchemaDocumentType = {
    ...doc,
    pages: nextPagesBase,
  };

  maybeApplyDocumentPostProcess(nextDoc, doc, deferPost);

  const editMeta: SectionEditMeta = {
    intents,
    scope,
    registrySwapped,
    neighborBlocksUpdated,
    primaryIntent: primaryIntent(intents),
  };

  const sessionEditContext = mergeSessionAfterEdit(
    params.sessionEditContext,
    params.sectionId,
    {
      intents: editMeta.intents,
      scope: editMeta.scope,
      registrySwapped: editMeta.registrySwapped,
    },
    instruction,
  );

  return {
    schema: SiteSchemaDocument.parse(nextDoc),
    replacedIndex: idx,
    pageIndex,
    registryKey,
    editMeta,
    sessionEditContext,
  };
}

/**
 * Regenerates up to three sections with one shared instruction, optional layout heuristic, then one document post-process.
 */
export async function regenerateSectionsBatch(params: {
  schemaJson: unknown;
  sectionIds: string[];
  instruction?: string;
  partialInput?: Partial<SitePlannerInput>;
  sessionEditContext?: SessionEditContext;
  invokeLlm?: ((messages: LlmMessage[]) => Promise<string | null>) | null;
}): Promise<{
  schema: SiteSchemaDocumentType;
  batchEditMeta: BatchRegenerateMeta;
  sessionEditContext: SessionEditContext;
}> {
  const ids = [...new Set(params.sectionIds.map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  if (ids.length === 0) {
    throw new Error("At least one section id is required");
  }

  const batchPlannerOpts: RunSitePlannerOptions | undefined = Object.prototype.hasOwnProperty.call(params, "invokeLlm")
    ? { invokeLlm: params.invokeLlm ?? null }
    : undefined;

  if (ids.length === 1) {
    const r = await regenerateSection({
      schemaJson: params.schemaJson,
      sectionId: ids[0]!,
      instruction: params.instruction,
      partialInput: params.partialInput,
      sessionEditContext: params.sessionEditContext,
      ...(batchPlannerOpts !== undefined ? { invokeLlm: batchPlannerOpts.invokeLlm ?? null } : {}),
    });
    return {
      schema: r.schema,
      batchEditMeta: {
        batchIntents: [],
        scope: r.editMeta.scope,
        layoutRestructureApplied: false,
        sectionIds: ids,
        singleEditMetaSummaries: [
          {
            sectionId: ids[0]!,
            primaryIntent: r.editMeta.primaryIntent,
            registrySwapped: r.editMeta.registrySwapped,
          },
        ],
      },
      sessionEditContext: r.sessionEditContext,
    };
  }

  const parsed = SiteSchemaDocument.safeParse(params.schemaJson);
  if (!parsed.success) {
    throw new Error("Invalid site schema");
  }
  const sourceDoc = parsed.data;
  let working: SiteSchemaDocumentType = sourceDoc;
  const instruction = params.instruction?.trim() || "";

  if (instruction) {
    const tokenResult = applyGlobalDesignTokenInstruction(working, instruction);
    if (tokenResult.applied) {
      const batchIntentsEarly = classifyBatchEditIntents(instruction, ids.length);
      applyTroothertzVisualPostProcessToDocument(working, styleModeFromSiteDocument(sourceDoc));
      applyBrandBrainAfterTroothertz(working, sourceDoc, "mixed");
      const sessionEditContext = mergeSessionAfterBatchEdit(
        params.sessionEditContext,
        ids,
        { intents: ["design_token_update"], scope: "route_level", registrySwapped: false },
        instruction,
      );
      return {
        schema: SiteSchemaDocument.parse(working),
        batchEditMeta: {
          batchIntents: batchIntentsEarly,
          scope: "route_level",
          layoutRestructureApplied: false,
          sectionIds: ids,
          singleEditMetaSummaries: ids.map((sectionId) => ({
            sectionId,
            primaryIntent: "design_token_update",
            registrySwapped: false,
          })),
        },
        sessionEditContext,
      };
    }
  }

  const batchIntents = classifyBatchEditIntents(instruction, ids.length);
  const singleIntents = classifyEditIntents(instruction);
  let scope: EditScope = resolveBatchEditScope(batchIntents, singleIntents, instruction);
  scope = applySessionBiasToScope(scope, singleIntents, params.sessionEditContext);

  let layoutRestructureApplied = false;
  let layoutRestructureKind: string | undefined;
  if (shouldApplyLayoutRestructureHeuristic(batchIntents)) {
    const { doc: reordered, applied, kind } = applyLayoutRestructureHeuristic(working, instruction, ids);
    if (applied) {
      working = reordered;
      layoutRestructureApplied = true;
      layoutRestructureKind = kind;
    }
  }

  let session: SessionEditContext | undefined = params.sessionEditContext;
  const singleEditMetaSummaries: BatchRegenerateMeta["singleEditMetaSummaries"] = [];

  for (const sectionId of ids) {
    const r = await regenerateSection({
      schemaJson: working,
      sectionId,
      instruction,
      partialInput: params.partialInput,
      sessionEditContext: session,
      deferDocumentPostProcess: true,
      suppressNeighborRegeneration: true,
      ...(batchPlannerOpts !== undefined ? { invokeLlm: batchPlannerOpts.invokeLlm ?? null } : {}),
    });
    working = r.schema;
    session = r.sessionEditContext;
    singleEditMetaSummaries.push({
      sectionId,
      primaryIntent: r.editMeta.primaryIntent,
      registrySwapped: r.editMeta.registrySwapped,
    });
  }

  applyTroothertzVisualPostProcessToDocument(working, styleModeFromSiteDocument(sourceDoc));
  applyBrandBrainAfterTroothertz(working, sourceDoc, "mixed");

  const registrySwappedAny = singleEditMetaSummaries.some((s) => s.registrySwapped);
  const sessionEditContext = mergeSessionAfterBatchEdit(session, ids, {
    intents: singleIntents,
    scope,
    registrySwapped: registrySwappedAny,
  }, instruction);

  return {
    schema: SiteSchemaDocument.parse(working),
    batchEditMeta: {
      batchIntents,
      scope,
      layoutRestructureApplied,
      layoutRestructureKind,
      sectionIds: ids,
      singleEditMetaSummaries,
    },
    sessionEditContext,
  };
}
