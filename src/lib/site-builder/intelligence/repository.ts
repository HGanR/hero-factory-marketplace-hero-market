import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";

/** Short, single-line message safe to surface in API metadata (no stack traces). */
export function safeIntelligenceError(err: unknown, maxLen = 180): string {
  const m = err instanceof Error ? err.message : String(err);
  return m.replace(/\s+/g, " ").trim().slice(0, maxLen);
}
import { hashPipelineInputPayload } from "@/lib/site-builder/ai/site-builder-intake";
import { hashSiteSchema } from "@/lib/site-builder/hash";
import {
  extractSchemaMetadataSnapshot,
  extractSectionRegistryKeys,
  layoutFingerprintFromPlanner,
} from "@/lib/site-builder/intelligence/extract-schema-metadata";
import type { getDb } from "@/lib/db";
import { mysqlRows } from "@/lib/site-builder/db";

export type DbClient = Awaited<ReturnType<typeof getDb>>;

export type SimilarSuccessfulVariantRow = {
  id: string;
  layoutVariantIndex: number | null;
  evaluationScore: number | null;
  sectionRegistryKeysJson: string;
  industry: string | null;
  siteType: string | null;
  createdAt: string;
};

export type FindSimilarInput = {
  industry?: string | null;
  siteType?: string | null;
  /** Minimum evaluation score to treat as “successful” when not published. Default 70. */
  minEvaluationScore?: number;
  limit?: number;
};

/**
 * Retrieves prior successful generation rows for the same user (same-industry bias).
 * Success = published status OR evaluation score ≥ threshold.
 * Does not load raw prompts — uses structural fields only.
 */
export async function findSimilarSuccessfulVariants(
  db: DbClient,
  userId: number,
  input: FindSimilarInput,
): Promise<SimilarSuccessfulVariantRow[]> {
  const minScore = input.minEvaluationScore ?? 70;
  const limit = Math.min(20, Math.max(1, input.limit ?? 10));
  const ind = (input.industry ?? "").trim().toLowerCase();
  const stRaw = (input.siteType ?? "").trim().toLowerCase();
  /** When the brief is "auto", do not require matching a resolved intent in DB. */
  const st = stRaw && stRaw !== "auto" ? stRaw : "";

  const raw = await (ind && st
    ? db.execute(sql`
        SELECT sgr.id, sgr.layoutVariantIndex, sgr.evaluationScore, sgr.sectionRegistryKeysJson, sgr.industry, sgr.siteType, sgr.createdAt
        FROM site_generation_runs sgr
        WHERE sgr.userId = ${userId}
          AND (
            (sgr.publishStatus IS NOT NULL AND UPPER(sgr.publishStatus) = 'PUBLISHED')
            OR (sgr.evaluationScore IS NOT NULL AND sgr.evaluationScore >= ${minScore})
          )
          AND LOWER(TRIM(COALESCE(sgr.industry, ''))) = ${ind}
          AND LOWER(TRIM(COALESCE(sgr.siteType, ''))) = ${st}
        ORDER BY
          (UPPER(COALESCE(sgr.publishStatus, '')) = 'PUBLISHED') DESC,
          COALESCE(sgr.rollupLeadsCaptured, sgr.leadCount, 0) DESC,
          (COALESCE(sgr.rollupConversationsOpened, 0) + COALESCE(sgr.rollupWidgetMessages, 0) + COALESCE(sgr.rollupBookingsScheduled, 0)) DESC,
          (
            SELECT COUNT(*) FROM site_variant_feedback f
            WHERE f.runId = sgr.id AND f.userId = sgr.userId
              AND (
                (f.rating IS NOT NULL AND f.rating >= 4)
                OR UPPER(TRIM(COALESCE(f.feedbackType, ''))) IN ('THUMBS_UP', 'APPROVE', 'LIKE', 'POSITIVE')
              )
          ) DESC,
          COALESCE(sgr.evaluationScore, 0) DESC,
          sgr.createdAt DESC
        LIMIT ${limit}
      `)
    : ind
      ? db.execute(sql`
        SELECT sgr.id, sgr.layoutVariantIndex, sgr.evaluationScore, sgr.sectionRegistryKeysJson, sgr.industry, sgr.siteType, sgr.createdAt
        FROM site_generation_runs sgr
        WHERE sgr.userId = ${userId}
          AND (
            (sgr.publishStatus IS NOT NULL AND UPPER(sgr.publishStatus) = 'PUBLISHED')
            OR (sgr.evaluationScore IS NOT NULL AND sgr.evaluationScore >= ${minScore})
          )
          AND LOWER(TRIM(COALESCE(sgr.industry, ''))) = ${ind}
        ORDER BY
          (UPPER(COALESCE(sgr.publishStatus, '')) = 'PUBLISHED') DESC,
          COALESCE(sgr.rollupLeadsCaptured, sgr.leadCount, 0) DESC,
          (COALESCE(sgr.rollupConversationsOpened, 0) + COALESCE(sgr.rollupWidgetMessages, 0) + COALESCE(sgr.rollupBookingsScheduled, 0)) DESC,
          (
            SELECT COUNT(*) FROM site_variant_feedback f
            WHERE f.runId = sgr.id AND f.userId = sgr.userId
              AND (
                (f.rating IS NOT NULL AND f.rating >= 4)
                OR UPPER(TRIM(COALESCE(f.feedbackType, ''))) IN ('THUMBS_UP', 'APPROVE', 'LIKE', 'POSITIVE')
              )
          ) DESC,
          COALESCE(sgr.evaluationScore, 0) DESC,
          sgr.createdAt DESC
        LIMIT ${limit}
      `)
      : db.execute(sql`
        SELECT sgr.id, sgr.layoutVariantIndex, sgr.evaluationScore, sgr.sectionRegistryKeysJson, sgr.industry, sgr.siteType, sgr.createdAt
        FROM site_generation_runs sgr
        WHERE sgr.userId = ${userId}
          AND (
            (sgr.publishStatus IS NOT NULL AND UPPER(sgr.publishStatus) = 'PUBLISHED')
            OR (sgr.evaluationScore IS NOT NULL AND sgr.evaluationScore >= ${minScore})
          )
        ORDER BY
          (UPPER(COALESCE(sgr.publishStatus, '')) = 'PUBLISHED') DESC,
          COALESCE(sgr.rollupLeadsCaptured, sgr.leadCount, 0) DESC,
          (COALESCE(sgr.rollupConversationsOpened, 0) + COALESCE(sgr.rollupWidgetMessages, 0) + COALESCE(sgr.rollupBookingsScheduled, 0)) DESC,
          (
            SELECT COUNT(*) FROM site_variant_feedback f
            WHERE f.runId = sgr.id AND f.userId = sgr.userId
              AND (
                (f.rating IS NOT NULL AND f.rating >= 4)
                OR UPPER(TRIM(COALESCE(f.feedbackType, ''))) IN ('THUMBS_UP', 'APPROVE', 'LIKE', 'POSITIVE')
              )
          ) DESC,
          COALESCE(sgr.evaluationScore, 0) DESC,
          sgr.createdAt DESC
        LIMIT ${limit}
      `));

  const rows = mysqlRows(raw) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    layoutVariantIndex: r.layoutVariantIndex != null ? Number(r.layoutVariantIndex) : null,
    evaluationScore: r.evaluationScore != null ? Number(r.evaluationScore) : null,
    sectionRegistryKeysJson: String(r.sectionRegistryKeysJson ?? "[]"),
    industry: r.industry != null ? String(r.industry) : null,
    siteType: r.siteType != null ? String(r.siteType) : null,
    createdAt: String(r.createdAt ?? ""),
  }));
}

function parseKeys(json: string): string[] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x)).filter(Boolean);
  } catch {
    return [];
  }
}

function countRegistryKeys(rows: SimilarSuccessfulVariantRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    for (const k of parseKeys(r.sectionRegistryKeysJson)) {
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return m;
}

export type EnrichResult = {
  input: SitePlannerInput;
  patternHints: string;
  matches: SimilarSuccessfulVariantRow[];
  suggestedLayoutVariantIndex?: number;
  enrichmentFailed?: boolean;
  enrichmentError?: string;
};

/**
 * Merges statistical signals from `findSimilarSuccessfulVariants` into planner input + hint text.
 * - Does not store or echo private CRM text.
 * - When the managed LLM is off, nudges `layoutVariantIndex` from the mode of prior successes (deterministic path).
 */
export async function enrichPlannerInputWithRetrievedPatterns(
  db: DbClient,
  userId: number,
  input: SitePlannerInput,
  findOpts?: FindSimilarInput,
): Promise<EnrichResult> {
  try {
    const industry = input.industry?.trim() || (findOpts?.industry?.trim() ?? undefined);
    const matches = await findSimilarSuccessfulVariants(db, userId, {
      industry: industry ?? null,
      siteType: input.siteType,
      minEvaluationScore: findOpts?.minEvaluationScore,
      limit: findOpts?.limit,
    });

    if (matches.length === 0) {
      return { input, patternHints: "", matches: [] };
    }

    const counts = countRegistryKeys(matches);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
    const patternHints = [
      "Pattern memory (structural): prior successful sites in this workspace often used these section registry keys:",
      top.length ? top.join(", ") : "(insufficient key overlap)",
      "Prefer overlapping registry keys in sectionPlan when they still fit the brief; retrieval ranks published and higher-engagement patterns ahead of raw scores alone; vary layout via layoutVariantIndex when the user asked for a fresh structure.",
    ].join(" ");

    const lvis = matches.map((m) => m.layoutVariantIndex).filter((n): n is number => n != null && n >= 0 && n <= 7);
    let suggestedLayoutVariantIndex: number | undefined;
    if (lvis.length) {
      const freq = new Map<number, number>();
      for (const n of lvis) freq.set(n, (freq.get(n) ?? 0) + 1);
      suggestedLayoutVariantIndex = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    }

    let nextInput = input;
    if (suggestedLayoutVariantIndex != null) {
      const hasExplicitLvi = input.layoutVariantIndex != null;
      if (!hasExplicitLvi) {
        nextInput = { ...input, layoutVariantIndex: suggestedLayoutVariantIndex };
      }
    }

    return { input: nextInput, patternHints, matches, suggestedLayoutVariantIndex };
  } catch (e) {
    console.error("enrichPlannerInputWithRetrievedPatterns failed", e);
    return {
      input,
      patternHints: "",
      matches: [],
      enrichmentFailed: true,
      enrichmentError: safeIntelligenceError(e),
    };
  }
}

export type RecordFullRunParams = {
  userId: number;
  siteId: string | undefined;
  clientId: string | null | undefined;
  input: SitePlannerInput;
  planner: SitePlannerOutput;
  /** Primary + alternates in order */
  schemas: Array<{ schema: unknown; seed: string; index: number }>;
  alternates: Array<{ seed: string; schema: unknown }>;
  evaluationScore: number | null;
  llmEnriched: boolean;
  publishStatus: string | null;
  leadCount: number | null;
  conversionRateBps: number | null;
  selectedVariantIndex?: number | null;
  rejectedVariantIndices?: number[] | null;
};

export type RecordSiteGenerationFullRunResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

/**
 * Inserts a run + variant rows. Call after a successful `full` pipeline.
 * Never throws — returns `{ ok: false, error }` on failure so callers can still return a preview schema.
 */
export async function recordSiteGenerationFullRun(
  db: DbClient,
  p: RecordFullRunParams,
): Promise<RecordSiteGenerationFullRunResult> {
  try {
    const runId = randomUUID();
    const promptSource = p.input.userPrompt.trim();
  const promptSummary = promptSource.length > 512 ? `${promptSource.slice(0, 509)}…` : promptSource;
  const promptHash = hashPipelineInputPayload(p.input);

  const sectionKeys = extractSectionRegistryKeys(p.planner);
  const primarySchema = p.schemas[0]?.schema;
  const primaryMeta = primarySchema
    ? extractSchemaMetadataSnapshot(primarySchema, p.planner)
    : { schemaHash: "", pageCount: 0, homeBlockCount: 0, hasWidget: false };

  const ctaGoal = p.planner.conversionGoal?.trim() ?? null;
  const designTokensJson = JSON.stringify(p.planner.designTokens ?? null);
  const sectionRegistryKeysJson = JSON.stringify(sectionKeys);
  const schemaMetadataJson = JSON.stringify(primaryMeta);
  const variantCount = p.schemas.length;
  const rejected = JSON.stringify(p.rejectedVariantIndices ?? []);

  const agentAttached = primaryMeta.hasWidget;

  /** Generation intelligence — independent of Site Builder session chat (see assistant-chat-persistence). */
  await db.execute(sql`
    INSERT INTO site_generation_runs (
      id, userId, siteId, clientId, pipelineStep, promptHash, promptSummary,
      industry, businessName, primaryOffer, audience, ctaGoal, siteType, designDirection, styleIntensity, web3VisualMode,
      layoutVariantIndex, selectedVariantIndex, variantCount, rejectedVariantIndicesJson,
      schemaMetadataJson, sectionRegistryKeysJson, designTokensJson, agentAttached, publishStatus, leadCount, conversionRateBps,
      evaluationScore, llmEnriched
    ) VALUES (
      ${runId},
      ${p.userId},
      ${p.siteId ?? null},
      ${p.clientId ?? null},
      ${"full"},
      ${promptHash},
      ${promptSummary || null},
      ${p.input.industry?.trim() || null},
      ${p.input.businessName?.trim() || null},
      ${p.input.primaryOffer?.trim() || null},
      ${p.input.audience?.trim() || null},
      ${ctaGoal},
      ${p.input.siteType},
      ${p.input.designDirection ?? null},
      ${p.input.styleIntensity},
      ${p.input.web3VisualMode ? 1 : 0},
      ${p.input.layoutVariantIndex ?? null},
      ${p.selectedVariantIndex ?? null},
      ${variantCount},
      ${rejected},
      ${schemaMetadataJson},
      ${sectionRegistryKeysJson},
      ${designTokensJson},
      ${agentAttached ? 1 : 0},
      ${p.publishStatus},
      ${p.leadCount},
      ${p.conversionRateBps},
      ${p.evaluationScore},
      ${p.llmEnriched ? 1 : 0}
    )
  `);

  for (const row of p.schemas) {
    const vId = randomUUID();
    const sHash = hashSiteSchema(row.schema);
    const fp = layoutFingerprintFromPlanner(p.planner);
    const layoutFp = JSON.stringify(fp);
    const evalI = row.index === 0 ? p.evaluationScore : null;
    const wasSelected = p.selectedVariantIndex == null ? row.index === 0 : p.selectedVariantIndex === row.index;
    const wasRejected = (p.rejectedVariantIndices ?? []).includes(row.index);

    await db.execute(sql`
      INSERT INTO site_generation_variants (
        id, runId, variantIndex, seed, schemaHash, wasSelected, wasRejected, evaluationScore, layoutFingerprintJson
      ) VALUES (
        ${vId},
        ${runId},
        ${row.index},
        ${row.seed},
        ${sHash},
        ${wasSelected ? 1 : 0},
        ${wasRejected ? 1 : 0},
        ${evalI},
        ${layoutFp}
      )
    `);
  }

    return { ok: true, runId };
  } catch (e) {
    console.error("recordSiteGenerationFullRun failed", e);
    return { ok: false, error: safeIntelligenceError(e) };
  }
}

export type UpdateSelectionParams = {
  runId: string;
  userId: number;
  selectedIndex: number;
  rejectedIndices: number[];
};

export async function updateRunVariantSelection(db: DbClient, p: UpdateSelectionParams): Promise<void> {
  try {
    const rejected = JSON.stringify(p.rejectedIndices);
    await db.execute(sql`
    UPDATE site_generation_runs
    SET selectedVariantIndex = ${p.selectedIndex},
        rejectedVariantIndicesJson = ${rejected},
        updatedAt = NOW()
    WHERE id = ${p.runId} AND userId = ${p.userId}
  `);
    await db.execute(sql`
    UPDATE site_generation_variants
    SET wasSelected = 0, wasRejected = 0
    WHERE runId = ${p.runId}
  `);
    await db.execute(sql`
    UPDATE site_generation_variants
    SET wasSelected = 1
    WHERE runId = ${p.runId} AND variantIndex = ${p.selectedIndex}
  `);
    for (const r of p.rejectedIndices) {
      await db.execute(sql`
      UPDATE site_generation_variants
      SET wasRejected = 1
      WHERE runId = ${p.runId} AND variantIndex = ${r}
    `);
    }
  } catch (e) {
    console.error("updateRunVariantSelection failed", e);
    throw e;
  }
}

export type RecordVariantFeedbackParams = {
  userId: number;
  runId: string | null;
  variantId: string | null;
  feedbackType: string;
  rating: number | null;
  noteSummary: string | null;
};

/**
 * User thumbs / ratings — `noteSummary` is optional short public summary; never pass CRM body text.
 */
export async function recordSiteVariantFeedback(db: DbClient, p: RecordVariantFeedbackParams): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO site_variant_feedback (id, runId, variantId, userId, feedbackType, rating, noteSummary)
    VALUES (
      ${id},
      ${p.runId},
      ${p.variantId},
      ${p.userId},
      ${p.feedbackType},
      ${p.rating},
      ${p.noteSummary}
    )
  `);
  return id;
}