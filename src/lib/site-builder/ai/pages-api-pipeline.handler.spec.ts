/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import handler from "@/pages/api/site-builder/ai/pipeline";
import { scoreVariantSetDiversity } from "@/lib/site-builder/ai/variant-diversity";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import {
  enrichPlannerInputWithRetrievedPatterns,
  recordSiteGenerationFullRun,
} from "@/lib/site-builder/intelligence/repository";
import { createToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(async () => ({ mocked: true })),
}));

jest.mock("@/lib/site-builder/ai/provider-resolver", () => ({
  resolveSiteBuilderLlmInvokeForSite: jest.fn(async () => null),
}));

jest.mock("@/lib/site-builder/intelligence/repository", () => ({
  enrichPlannerInputWithRetrievedPatterns: jest.fn(async (_db, _userId, input) => ({
    input,
    patternHints: "",
    matches: [],
  })),
  recordSiteGenerationFullRun: jest.fn(async () => ({ ok: true, runId: "run-1" })),
}));

jest.mock("@/lib/site-builder/ai/planner", () => ({
  runSitePlanner: jest.fn(async () => ({
    output: {
      siteTitle: "Mock Site",
      styleMode: "minimal",
      sitemap: [{ slug: "/", title: "Home" }],
      sectionPlan: [{ id: "hero", registryKey: "hero" }, { id: "cta", registryKey: "cta" }],
    },
    llmEnriched: true,
    llmUsed: true,
    llmModel: "gpt-4o-mini",
    llmProvider: "env" as const,
  })),
}));

jest.mock("@/lib/site-builder/ai/cinematic-planner-layer", () => ({
  applyCinematicPostProcessToPlannerOutput: jest.fn((_input, output: { sectionPlan?: Array<Record<string, unknown>> }) => {
    const sp = Array.isArray(output.sectionPlan) ? output.sectionPlan : [];
    output.sectionPlan = sp.map((row) => ({
      ...row,
      sectionRole: String(row.registryKey || "").includes("hero") ? "hero" : "narrative",
    }));
    return output;
  }),
}));

jest.mock("@/lib/site-builder/ai/generator", () => ({
  generateSiteSchemaFromPlanner: jest.fn(() => ({
    version: 1,
    pages: [
      {
        slug: "/",
        blocks: [{ type: "hero", content: { title: "Hello" } }],
      },
    ],
    metadata: { title: "Mock Site" },
  })),
  buildPageBlueprint: jest.fn(() => ({ pages: 1 })),
}));

jest.mock("@/lib/site-builder/apply-refinement", () => ({
  applyRefinementToSchema: jest.fn((schema) => schema),
}));

jest.mock("@/lib/site-builder/brand-brain-pipeline", () => ({
  finalizeGenerationWithTroothertzAndBrandBrain: jest.fn(() => undefined),
}));

jest.mock("@/lib/site-builder/ai/evaluator", () => ({
  evaluateSiteSchema: jest.fn(() => ({ score: 78 })),
}));

jest.mock("@/lib/site-builder/ai/block-registry", () => ({
  getRegistryEntry: jest.fn(() => ({ id: "ok" })),
}));

jest.mock("@/lib/site-builder/ai/variant-diversity", () => ({
  scoreVariantSetDiversity: jest.fn(),
}));

const mockScoreVariantSetDiversity = jest.mocked(scoreVariantSetDiversity);
const mockRunSitePlanner = jest.mocked(runSitePlanner);
const mockGenerateSiteSchema = jest.mocked(generateSiteSchemaFromPlanner);
const mockEnrich = jest.mocked(enrichPlannerInputWithRetrievedPatterns);
const mockRecordSiteGenerationFullRun = jest.mocked(recordSiteGenerationFullRun);

function createMockReq(body: unknown) {
  const token = createToken({ userId: 101 });
  return {
    method: "POST",
    body,
    headers: { cookie: `auth-token=${encodeURIComponent(token)}` },
  } as any;
}

function createMockRes() {
  const out: { statusCode: number; jsonBody: any } = { statusCode: 200, jsonBody: null };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return this;
    },
    json(payload: any) {
      out.jsonBody = payload;
      return this;
    },
    setHeader() {
      return this;
    },
  } as any;
  return { res, out };
}

describe("pages /api/site-builder/ai/pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SITE_BUILDER_PIPELINE_TIMEOUT_MS;
    mockScoreVariantSetDiversity.mockReturnValueOnce(0.08).mockReturnValueOnce(0.41);
  });

  it("401 without auth includes generationRuntime", async () => {
    const req = {
      method: "POST",
      body: { step: "full", variantCount: 1, input: { userPrompt: "x", siteType: "web3_product" } },
      headers: {},
    } as any;
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(401);
    expect(out.jsonBody.error).toBe("Unauthorized");
    expect(out.jsonBody.generationRuntime).toBe("pages-node");
  });

  it("405 for non-POST includes generationRuntime", async () => {
    const token = createToken({ userId: 101 });
    const req = {
      method: "GET",
      body: {},
      headers: { cookie: `auth-token=${encodeURIComponent(token)}` },
    } as any;
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(405);
    expect(out.jsonBody.error).toBe("Method not allowed");
    expect(out.jsonBody.generationRuntime).toBe("pages-node");
  });

  it("returns schema for full build with generationMeta llm fields", async () => {
    const req = createMockReq({
      step: "full",
      variantCount: 1,
      input: {
        userPrompt: "Build a bold Web3 consulting landing page",
        siteType: "web3_product",
      },
    });
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(200);
    expect(out.jsonBody.schema).toBeTruthy();
    expect(out.jsonBody.generationMeta).toBeTruthy();
    expect(out.jsonBody.generationMeta.llmUsed).toBe(true);
    expect(out.jsonBody.generationMeta.llmModel).toBe("gpt-4o-mini");
    expect(out.jsonBody.generationMeta.intelligenceStatus).toBe("ok");
    expect(typeof out.jsonBody.generationMeta.critiqueScore).toBe("number");
    expect(Array.isArray(out.jsonBody.generationMeta.critiqueIssues)).toBe(true);
    expect(typeof out.jsonBody.generationMeta.autoRepaired).toBe("boolean");
    expect(out.jsonBody.generationMeta.designSystemApplied).toBe(true);
    expect(out.jsonBody.generationMeta.sectionRolesAssigned).toBe(true);
    expect(out.jsonBody.generationMeta.layoutEnforced).toBe(true);
    expect(out.jsonBody.generationRuntime).toBe("pages-node");
    expect(mockRunSitePlanner).toHaveBeenCalled();
    expect(mockGenerateSiteSchema).toHaveBeenCalled();
  });

  it("timeout returns structured error", async () => {
    process.env.SITE_BUILDER_PIPELINE_TIMEOUT_MS = "5";
    mockRunSitePlanner.mockImplementationOnce(
      async () =>
        await new Promise<never>(() => {
          /* hang */
        }),
    );
    const req = createMockReq({
      step: "full",
      variantCount: 1,
      input: { userPrompt: "Build", siteType: "web3_product" },
    });
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(504);
    expect(out.jsonBody.retryable).toBe(true);
    expect(out.jsonBody.stage).toBe("planner_started");
    expect(out.jsonBody.generationRuntime).toBe("pages-node");
  });

  it("persistence failure does not block schema response", async () => {
    mockRecordSiteGenerationFullRun.mockResolvedValueOnce({ ok: false, error: "db write failed" });
    const req = createMockReq({
      step: "full",
      variantCount: 1,
      input: { userPrompt: "Build", siteType: "web3_product" },
    });
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(200);
    expect(out.jsonBody.schema).toBeTruthy();
    expect(out.jsonBody.generationMeta.intelligenceStatus).toBe("failed");
    expect(out.jsonBody.generationMeta.intelligenceError).toMatch(/db write failed/);
    expect(out.jsonBody.generationRuntime).toBe("pages-node");
  });

  it("enrichment failure does not block schema response and marks generationMeta", async () => {
    mockEnrich.mockImplementationOnce(async (_db, _userId, input) => ({
      input,
      patternHints: "",
      matches: [],
      enrichmentFailed: true,
      enrichmentError: "retrieval query failed",
    }));
    const req = createMockReq({
      step: "full",
      variantCount: 1,
      input: { userPrompt: "Build", siteType: "web3_product" },
    });
    const { res, out } = createMockRes();
    await handler(req, res);
    expect(out.statusCode).toBe(200);
    expect(out.jsonBody.schema).toBeTruthy();
    expect(out.jsonBody.generationMeta.intelligenceStatus).toBe("failed");
    expect(out.jsonBody.generationMeta.intelligenceError).toMatch(/retrieval query failed/);
  });
});
