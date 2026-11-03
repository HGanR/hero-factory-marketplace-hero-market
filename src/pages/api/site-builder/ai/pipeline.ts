import { runFullSiteGeneration, PipelineTimeoutError } from "@/lib/site-builder/ai/full-generation";
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";
import { marketplaceUserIdFromSessionCookiePair } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { applyCinematicPostProcessToPlannerOutput } from "@/lib/site-builder/ai/cinematic-planner-layer";
import { evaluateSiteSchema } from "@/lib/site-builder/ai/evaluator";
import { generateSiteSchemaFromPlanner, buildPageBlueprint } from "@/lib/site-builder/ai/generator";
import { runSitePlanner, type RunSitePlannerOptions } from "@/lib/site-builder/ai/planner";
import { chooseVariantLayoutFamilies, getLayoutFamilyById } from "@/lib/site-builder/ai/layout-families";
import { scoreVariantSetDiversity } from "@/lib/site-builder/ai/variant-diversity";
import { resolveSiteBuilderLlmInvokeForSite } from "@/lib/site-builder/ai/provider-resolver";
import { PipelineRequestSchema, type SitePlannerInput, type SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { regenerateSection, regenerateSectionsBatch } from "@/lib/site-builder/ai/regenerate-section";
import { applyRefinementToSchema } from "@/lib/site-builder/apply-refinement";
import { finalizeGenerationWithTroothertzAndBrandBrain } from "@/lib/site-builder/brand-brain-pipeline";
import { getRegistryEntry } from "@/lib/site-builder/ai/block-registry";
import { applyBuildCritiqueRepairs, critiqueSiteBuild } from "@/lib/site-builder/ai/build-critique";
import { buildContentBrief, runContentIntelligencePipeline } from "@/lib/site-builder/ai/content-intelligence";
import { isGlobalManagedLlmConfigured, invokeNpcLlm } from "@/lib/npc/llm";
import {
  enrichPlannerInputWithRetrievedPatterns,
  recordSiteGenerationFullRun,
} from "@/lib/site-builder/intelligence/repository";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { SiteBuilderLlmSource } from "@/lib/site-builder/ai/providers/types";

type PlannerPath = "llm_enriched" | "deterministic_fallback";
type IntelligenceStatus = "ok" | "skipped" | "failed";
type GenerationMeta = {
  plannerPath: PlannerPath;
  layoutFamilyId?: string;
  diversityScore: number;
  retryCount: number;
  registryDrops: number;
  intelligenceMatchCount: number;
  intelligenceStatus: IntelligenceStatus;
  intelligenceError?: string;
  /** True when the structured planner output came from a successful LLM parse. */
  llmUsed: boolean;
  llmModel?: string;
  /** env | site_managed | site_byok | none */
  llmProvider?: "env" | "site_managed" | "site_byok" | "none";
  /** Per-site mode from site-builder AI settings (when `siteId` was sent). */
  siteLlmMode?: SiteBuilderLlmSource;
  /** When `llmUsed` is false, short machine reason (e.g. `no_llm_configured`, `llm_parse_failed`). */
  fallbackReason?: string;
  contentIntelligence?: {
    contentScore: number;
    repaired: boolean;
    issues: string[];
    /** Heuristic: still generic or weak after repair */
    genericContentWarning?: boolean;
  };
  /** When the request included an `inspirationBrief`, layout/cinematic/tone were nudged (not a clone). */
  inspirationPatternsUsed?: boolean;
  critiqueScore?: number;
  critiqueIssues?: string[];
  autoRepaired?: boolean;
  layoutEnforced?: boolean;
  designSystemApplied?: boolean;
  sectionRolesAssigned?: boolean;
};

function buildGenerationDesignFlags(
  input: SitePlannerInput | undefined,
  planner: SitePlannerOutput,
): { layoutEnforced: boolean; designSystemApplied: boolean; sectionRolesAssigned: boolean } {
  const fid = input?.layoutFamilyId?.trim();
  const layoutEnforced = Boolean(fid && getLayoutFamilyById(fid));
  const sectionRolesAssigned =
    Array.isArray(planner.sectionPlan) &&
    planner.sectionPlan.length > 0 &&
    planner.sectionPlan.every((s) => typeof s.sectionRole === "string");
  return {
    layoutEnforced,
    designSystemApplied: true,
    sectionRolesAssigned,
  };
}

type VariantOutput = {
  seed: string;
  schema: SiteSchemaDocumentType;
  planner: unknown;
  generationMeta: GenerationMeta;
};

const DIVERSITY_THRESHOLD = 0.26;
const MAX_VARIANT_RETRIES = 2;
const GENERATION_RUNTIME = "pages-node" as const;


function stageTimeoutMs(defaultMs: number): number {
  const raw = process.env.SITE_BUILDER_PIPELINE_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}

async function withStageTimeout<T>(stage: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new PipelineTimeoutError(stage, ms)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function logPipelineStage(requestId: string, stage: string, extra?: Record<string, unknown>) {
  console.info(`[site-builder-pipeline] ${requestId} ${stage}`, extra ?? {});
}

function mergeIntelligenceErrors(a?: string, b?: string): string | undefined {
  const parts = [a, b].filter(Boolean) as string[];
  if (!parts.length) return undefined;
  return parts.join("; ").slice(0, 220);
}

function computeIntelligenceStatus(
  retrievalSkipped: boolean,
  enrichFailed: boolean,
  recordOk: boolean,
): IntelligenceStatus {
  if (enrichFailed || !recordOk) return "failed";
  if (retrievalSkipped) return "skipped";
  return "ok";
}

function runCritiqueAndRepairStep(
  variantInput: SitePlannerInput,
  plannerOutput: SitePlannerOutput,
  schema: SiteSchemaDocumentType,
): {
  schema: SiteSchemaDocumentType;
  critiqueScore: number;
  critiqueIssues: string[];
  autoRepaired: boolean;
} {
  const brief = buildContentBrief(variantInput, plannerOutput);
  const pack = critiqueSiteBuild(schema, variantInput.industry || "");
  const { doc, repaired } = applyBuildCritiqueRepairs(schema, brief, pack);
  return {
    schema: repaired ? SiteSchemaDocument.parse(doc) : schema,
    critiqueScore: pack.score,
    critiqueIssues: pack.issues,
    autoRepaired: repaired,
  };
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function getAuthedUserIdFromPagesReq(req: NextApiRequest): number | null {
  const parsed = parseCookieHeader(req.headers.cookie);
  return marketplaceUserIdFromSessionCookiePair(parsed["auth-token"] ?? "", parsed["admin-token"] ?? "");
}

function computeRegistryDrops(planner: { sectionPlan?: Array<{ registryKey?: string }> }): number {
  const rows = Array.isArray(planner.sectionPlan) ? planner.sectionPlan : [];
  let drops = 0;
  for (const row of rows) {
    const key = typeof row?.registryKey === "string" ? row.registryKey : "";
    if (!key) continue;
    if (!getRegistryEntry(key)) drops += 1;
  }
  return drops;
}

/**
 * Resolves `invokeLlm` for the planner. Always merges in the global OpenAI / NPC invoker
 * when `OPENAI_API_KEY` or `NPC_LLM_ENDPOINT` is set, so the pipeline is not left without an LLM
 * when per-site settings return null (e.g. platform mode with no prior global in the row).
 * Site `llmMode: off` still forces deterministic.
 */
async function resolvePlannerOpts(
  userId: number,
  siteId: string | undefined,
): Promise<RunSitePlannerOptions | undefined> {
  const hasGlobal = isGlobalManagedLlmConfigured();
  const globalOpts: RunSitePlannerOptions = {
    invokeLlm: invokeNpcLlm,
    llmSource: "managed",
  };

  if (!siteId?.trim()) {
    return hasGlobal ? globalOpts : undefined;
  }

  const db = await getDb();
  const r = await resolveSiteBuilderLlmInvokeForSite(db, userId, siteId.trim());
  if (!r) {
    return hasGlobal ? globalOpts : undefined;
  }
  if (r.forceDeterministic) {
    return { invokeLlm: null, forceDeterministic: true, llmSource: r.source };
  }
  if (r.invokeLlm) {
    return { invokeLlm: r.invokeLlm, llmSource: r.source, forceDeterministic: r.forceDeterministic };
  }
  if (hasGlobal) {
    return globalOpts;
  }
  return { invokeLlm: null, llmSource: r.source };
}

function sendJson(res: NextApiResponse, status: number, payload: Record<string, unknown>) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed", generationRuntime: GENERATION_RUNTIME });
  }

  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const userId = getAuthedUserIdFromPagesReq(req);
  if (!userId) return sendJson(res, 401, { error: "Unauthorized", generationRuntime: GENERATION_RUNTIME });

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON", generationRuntime: GENERATION_RUNTIME });
    }
  }

  const parsed = PipelineRequestSchema.safeParse(body);
  if (!parsed.success) {
    return sendJson(res, 400, {
      error: "Invalid request",
      issues: parsed.error.issues,
      generationRuntime: GENERATION_RUNTIME,
    });
  }

  let stage = "api_request_started";
  logPipelineStage(requestId, "api_request_started", { step: parsed.data.step });
  try {
    const siteId = "siteId" in parsed.data ? parsed.data.siteId : undefined;
    const plannerSiteOpts = await resolvePlannerOpts(userId, siteId);

    switch (parsed.data.step) {
      case "plan": {
        const db = await getDb();
        const enriched = await enrichPlannerInputWithRetrievedPatterns(db, userId, parsed.data.input, {
          industry: parsed.data.input.industry ?? null,
          siteType: String(parsed.data.input.siteType),
        });
        const { output, llmEnriched, llmModel, llmUsed, llmProvider, fallbackReason } = await runSitePlanner(
          enriched.input,
          {
            ...(plannerSiteOpts ?? {}),
            intelligencePatternHints: enriched.patternHints || undefined,
          },
        );
        const outputCinematic = applyCinematicPostProcessToPlannerOutput(enriched.input, output, {
          variantIndex: 0,
          variantCount: 1,
        });
        return sendJson(res, 200, {
          planner: outputCinematic,
          llmEnriched,
          llmModel,
          llmUsed,
          llmProvider,
          fallbackReason,
          intelligencePatternHints: enriched.patternHints,
          intelligenceMatchCount: enriched.matches.length,
          intelligenceStatus: enriched.enrichmentFailed ? "failed" : "ok",
          intelligenceError: enriched.enrichmentError,
          llmFallbackWarning:
            !llmUsed
              ? "LLM did not produce structured output — using deterministic template path. Set OPENAI_API_KEY or NPC_LLM_* in the deployment, and/or site AI mode to platform/BYOK."
              : undefined,
          generationRuntime: GENERATION_RUNTIME,
        });
      }
      case "full": {
        return sendJson(res, 200, await runFullSiteGeneration(parsed.data, userId, plannerSiteOpts, {
          db: await getDb(), requestId,
        }));
      }
      case "evaluate": {
        const doc = SiteSchemaDocument.safeParse(parsed.data.schemaJson);
        if (!doc.success) {
          return sendJson(res, 400, {
            error: "Invalid schemaJson",
            issues: doc.error.issues,
            generationRuntime: GENERATION_RUNTIME,
          });
        }
        const evaluation = evaluateSiteSchema(doc.data);
        return sendJson(res, 200, { evaluation, generationRuntime: GENERATION_RUNTIME });
      }
      case "generate": {
        const gen = parsed.data;
        const n = Math.min(3, Math.max(1, gen.variantCount ?? 1));
        const baseSeed = gen.variantSeed?.trim() || `v1-${randomUUID()}`;
        const families = chooseVariantLayoutFamilies(n, baseSeed, gen.input.inspirationBrief, gen.input);
        const inspirationPatternsUsed = Boolean(gen.input.inspirationBrief);
        const seeds = Array.from({ length: n }, (_, i) => (i === 0 ? baseSeed : `${baseSeed}-alt${i}`));
        const makeVariant = async (seed: string, variantIndex: number, retryCount = 0): Promise<VariantOutput> => {
          const family = families[variantIndex] ?? families[0];
          const variantInput = {
            ...gen.input,
            layoutVariantIndex: variantIndex,
            layoutFamilyId: family?.id,
            variantIntent: family?.intent,
          };
          const ran = await runSitePlanner(variantInput, {
            ...(plannerSiteOpts ?? {}),
          });
          const plannerPath: PlannerPath = ran.llmEnriched ? "llm_enriched" : "deterministic_fallback";
          const p = applyCinematicPostProcessToPlannerOutput(variantInput, ran.output, {
            variantIndex,
            variantCount: n,
          });
          let s = generateSiteSchemaFromPlanner(p, seed, { plannerInput: variantInput });
          const md = s.metadata;
          if (!md) {
            throw new Error("pipeline invariant: schema missing metadata after planner generation");
          }
          if (gen.siteBuilderAssets && typeof gen.siteBuilderAssets === "object") {
            const prev = (md.siteBuilderAssets as Record<string, unknown> | undefined) ?? {};
            md.siteBuilderAssets = {
              ...prev,
              ...(gen.siteBuilderAssets as Record<string, unknown>),
            } as NonNullable<SiteSchemaDocumentType["metadata"]>["siteBuilderAssets"];
          }
          if (gen.input.widgetKey) {
            const prev = md.widgetIntegration;
            md.widgetIntegration = {
              widgetKey: gen.input.widgetKey,
              placement: gen.input.widgetPlacement ?? "body_end",
              loaderOrigin: prev?.loaderOrigin,
              pageSlug: prev?.pageSlug,
              injectInDevPreviewTab: prev?.injectInDevPreviewTab ?? true,
            };
          }
          s = applyRefinementToSchema(s, gen.refinement);
          finalizeGenerationWithTroothertzAndBrandBrain(s);
          const ciG = runContentIntelligencePipeline(variantInput, p, s);
          s = SiteSchemaDocument.parse(ciG.document);
          const contentIntelligence = {
            contentScore: ciG.meta.contentScore,
            repaired: ciG.meta.repaired,
            issues: ciG.meta.issues,
            genericContentWarning:
              ciG.meta.contentScore < 55 || ciG.meta.issues.some((x) => /vague|generic|weak|too_broad/i.test(x)),
          };
          const critG = runCritiqueAndRepairStep(variantInput, p, s);
          s = critG.schema;
          return {
            seed,
            schema: s,
            planner: p,
            generationMeta: {
              plannerPath,
              layoutFamilyId: family?.id,
              diversityScore: 1,
              retryCount,
              registryDrops: computeRegistryDrops(p),
              intelligenceMatchCount: 0,
              intelligenceStatus: "skipped",
              llmUsed: ran.llmUsed,
              llmModel: ran.llmModel,
              llmProvider: ran.llmProvider,
              siteLlmMode: plannerSiteOpts?.llmSource,
              fallbackReason: ran.fallbackReason,
              contentIntelligence,
              inspirationPatternsUsed,
              critiqueScore: critG.critiqueScore,
              critiqueIssues: critG.critiqueIssues,
              autoRepaired: critG.autoRepaired,
              ...buildGenerationDesignFlags(variantInput, p),
            },
          };
        };
        const variants: VariantOutput[] = [];
        for (let i = 0; i < n; i++) variants.push(await makeVariant(seeds[i]!, i));
        let retryCount = 0;
        let diversityScore = scoreVariantSetDiversity(variants.map((v) => v.schema));
        while (n > 1 && diversityScore < DIVERSITY_THRESHOLD && retryCount < MAX_VARIANT_RETRIES) {
          retryCount += 1;
          for (let i = 1; i < variants.length; i++) {
            const retrySeed = `${seeds[i]!}-retry${retryCount}`;
            variants[i] = await makeVariant(retrySeed, i, retryCount);
          }
          diversityScore = scoreVariantSetDiversity(variants.map((v) => v.schema));
        }
        variants.forEach((v) => {
          v.generationMeta.diversityScore = diversityScore;
          v.generationMeta.retryCount = retryCount;
        });
        const schema = variants[0]!.schema;
        const primaryPlanner = variants[0]!.planner as Parameters<typeof buildPageBlueprint>[0];
        const schemaAlternates = variants.slice(1).map((v) => ({
          seed: v.seed,
          schema: v.schema,
          generationMeta: v.generationMeta,
        }));
        const blueprint = buildPageBlueprint(primaryPlanner);
        const evaluation = evaluateSiteSchema(schema);
        return sendJson(res, 200, {
          schema,
          schemaAlternates: schemaAlternates.length ? schemaAlternates : undefined,
          variantSeeds: variants.map((v) => v.seed),
          blueprint,
          evaluation,
          generationMeta: variants[0]!.generationMeta,
          llmModel: variants[0]!.generationMeta.llmModel,
          llmProvider: variants[0]!.generationMeta.llmProvider,
          llmFallbackWarning: !variants[0]!.generationMeta.llmUsed
            ? "LLM did not produce structured output — using deterministic template path. Set OPENAI_API_KEY or NPC_LLM_* on the deployment, and/or set site AI mode to platform/BYOK in Site settings."
            : undefined,
          generationRuntime: GENERATION_RUNTIME,
        });
      }
      case "regenerate_section": {
        const result = await regenerateSection({
          schemaJson: parsed.data.schemaJson,
          sectionId: parsed.data.sectionId,
          instruction: parsed.data.instruction,
          partialInput: parsed.data.input,
          sessionEditContext: parsed.data.sessionEditContext,
          ...(plannerSiteOpts !== undefined ? { invokeLlm: plannerSiteOpts.invokeLlm ?? null } : {}),
        });
        const evaluation = evaluateSiteSchema(result.schema);
        return sendJson(res, 200, {
          schema: result.schema,
          replacedIndex: result.replacedIndex,
          pageIndex: result.pageIndex,
          registryKey: result.registryKey,
          editMeta: result.editMeta,
          sessionEditContext: result.sessionEditContext,
          evaluation,
          generationRuntime: GENERATION_RUNTIME,
        });
      }
      case "regenerate_sections_batch": {
        const result = await regenerateSectionsBatch({
          schemaJson: parsed.data.schemaJson,
          sectionIds: parsed.data.sectionIds,
          instruction: parsed.data.instruction,
          partialInput: parsed.data.input,
          sessionEditContext: parsed.data.sessionEditContext,
          ...(plannerSiteOpts !== undefined ? { invokeLlm: plannerSiteOpts.invokeLlm ?? null } : {}),
        });
        const evaluation = evaluateSiteSchema(result.schema);
        return sendJson(res, 200, {
          schema: result.schema,
          batchEditMeta: result.batchEditMeta,
          sessionEditContext: result.sessionEditContext,
          evaluation,
          generationRuntime: GENERATION_RUNTIME,
        });
      }
      default:
        return sendJson(res, 400, { error: "Unsupported step", generationRuntime: GENERATION_RUNTIME });
    }
  } catch (err) {
    if (err instanceof PipelineTimeoutError) {
      logPipelineStage(requestId, "timeout", { stage: err.stage, durationMs: Date.now() - startedAt });
      return sendJson(res, 504, {
        error: err.message,
        stage: err.stage,
        retryable: true,
        generationRuntime: GENERATION_RUNTIME,
      });
    }
    const message = err instanceof Error ? err.message : "Pipeline failed";
    logPipelineStage(requestId, "failed", { stage, durationMs: Date.now() - startedAt, message });
    return sendJson(res, 500, {
      error: message,
      stage,
      retryable: true,
      generationRuntime: GENERATION_RUNTIME,
    });
  }
}

