import { z } from "zod";
import { buildCinematicNarrativeEnrichment } from "@/lib/site-builder/ai/cinematic-design-intent";
import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";

/**
 * Client-side required intake; maps to a single `userPrompt` narrative for the pipeline.
 * Optional fields in Zod for partial saves; "full" build gates on the three required strings.
 */
export const SiteBuilderIntakeFieldsSchema = z.object({
  businessName: z.string().max(200),
  primaryOffer: z.string().max(800),
  audience: z.string().max(800),
  industry: z.string().max(200),
  market: z.string().max(200),
  additionalNotes: z.string().max(8000),
  conversionGoal: z.string().max(500),
  brandTone: z.string().max(400),
  designPreference: z.string().max(400),
  /** One URL per line or comma-separated — merged into competitor URL list on the client. */
  inspirationWebsites: z.string().max(2000),
  trustAndProof: z.string().max(1200),
});

export type SiteBuilderIntakeFields = z.infer<typeof SiteBuilderIntakeFieldsSchema>;

const FullIntakeSchema = z.object({
  businessName: z.string().trim().min(1, "Business or brand name is required."),
  primaryOffer: z.string().trim().min(1, "Primary offer is required."),
  audience: z.string().trim().min(1, "Target audience is required."),
});

/** Enough freeform text in the command bar to run a one-shot full build without the structured triplet. */
export const MIN_ADDITIONAL_NOTES_FOR_PROMPT_ONLY_FULL_BUILD = 24;

/**
 * Synthesized narrative: structured slots + industry/market + optional freeform notes.
 * If no structured triplet is present, returns notes only (or a minimal join of any filled fields) for plan-only / migration.
 */
export function buildNarrativeFromIntake(intake: SiteBuilderIntakeFields): string {
  const b = intake.businessName.trim();
  const o = intake.primaryOffer.trim();
  const a = intake.audience.trim();
  const ind = intake.industry.trim();
  const m = intake.market.trim();
  const notes = intake.additionalNotes.trim();
  const hasStructured = Boolean(b && o && a);
  if (!hasStructured) {
    const fall = [
      b,
      o,
      a,
      ind,
      m,
      intake.conversionGoal,
      intake.brandTone,
      intake.designPreference,
      intake.inspirationWebsites,
      intake.trustAndProof,
      notes,
    ].filter((x) => (x ?? "").toString().trim().length > 0) as string[];
    return fall.join(" — ") || notes;
  }
  const parts: string[] = [];
  parts.push(`## ${b}`);
  parts.push(`**Primary offer:** ${o}`);
  parts.push(`**Target audience:** ${a}`);
  if (ind) parts.push(`**Industry / vertical:** ${ind}`);
  if (m) parts.push(`**Market / geography:** ${m}`);
  const cg = intake.conversionGoal?.trim();
  if (cg) parts.push(`**Conversion goal:** ${cg}`);
  const tone = intake.brandTone?.trim();
  if (tone) parts.push(`**Brand tone:** ${tone}`);
  const des = intake.designPreference?.trim();
  if (des) parts.push(`**Design preference:** ${des}`);
  const insp = intake.inspirationWebsites?.trim();
  if (insp) parts.push(`**Inspiration / reference sites:**\n${insp}`);
  const trust = intake.trustAndProof?.trim();
  if (trust) parts.push(`**Trust, proof, or credentials:**\n${trust}`);
  if (notes) parts.push(`\n**Additional context:**\n${notes}`);
  return parts.join("\n");
}

function stableValue(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return stableStringifyForHash(v as Record<string, unknown>);
  }
  return JSON.stringify(v);
}

/** Deterministic string for pipeline input so identical form state → identical hash. */
function stableStringifyForHash(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort() as string[];
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableValue((obj as Record<string, unknown>)[k])).join(",")}}`;
}

export function hashDjb2Hex(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function hashPipelineInputPayload(input: SitePlannerInput): string {
  const o: Record<string, unknown> = {
    userPrompt: input.userPrompt,
    industry: input.industry ?? null,
    market: input.market ?? null,
    businessName: input.businessName ?? null,
    primaryOffer: input.primaryOffer ?? null,
    audience: input.audience ?? null,
    siteType: input.siteType,
    designDirection: input.designDirection ?? null,
    styleIntensity: input.styleIntensity,
    web3VisualMode: input.web3VisualMode,
    layoutVariantIndex: input.layoutVariantIndex ?? null,
    layoutFamilyId: input.layoutFamilyId ?? null,
    variantIntent: input.variantIntent ?? null,
    widgetKey: input.widgetKey ?? null,
    widgetPlacement: input.widgetPlacement ?? null,
    inspirationUrl: input.inspirationUrl ?? null,
    competitorUrls: input.competitorUrls ?? null,
    inspirationIndustryOnly: input.inspirationIndustryOnly ?? null,
    inspirationBriefFingerprint: input.inspirationBrief
      ? stableStringifyForHash({
          tone: input.inspirationBrief.tone,
          layoutPatterns: input.inspirationBrief.layoutPatterns,
          keywordThemes: input.inspirationBrief.keywordThemes,
        })
      : null,
    statedConversionGoal: input.statedConversionGoal ?? null,
    statedBrandTone: input.statedBrandTone ?? null,
    statedDesignPreference: input.statedDesignPreference ?? null,
    statedTrustAndProof: input.statedTrustAndProof ?? null,
  };
  return hashDjb2Hex(stableStringifyForHash(o));
}

/** When `buildForClient` is true, full generation requires a Revenue OS hub client id. */
export type FullBuildClientGate = {
  buildForClient?: boolean;
  revenueOsClientId?: string;
};

export function validateIntakeForFullBuild(
  intake: SiteBuilderIntakeFields,
  clientGate?: FullBuildClientGate,
):
  | { ok: true }
  | { ok: false; message: string; issues: string[] } {
  const r = FullIntakeSchema.safeParse({
    businessName: intake.businessName,
    primaryOffer: intake.primaryOffer,
    audience: intake.audience,
  });
  const notesOk = intake.additionalNotes.trim().length >= MIN_ADDITIONAL_NOTES_FOR_PROMPT_ONLY_FULL_BUILD;
  if (!r.success && !notesOk) {
    const issues = r.error.issues.map((i) => i.message);
    return {
      ok: false,
      message: `Fill in business or brand name, primary offer, and target audience — or write at least ${MIN_ADDITIONAL_NOTES_FOR_PROMPT_ONLY_FULL_BUILD} characters in the command bar describing your site.`,
      issues: issues.length ? issues : ["Intake is incomplete."],
    };
  }
  if (clientGate?.buildForClient) {
    const cid = (clientGate.revenueOsClientId ?? "").trim();
    if (!cid) {
      return {
        ok: false,
        message: "Pick a Revenue OS client (or turn off “Build for client”) before generating a full site.",
        issues: ["Revenue OS client is required when building for a client."],
      };
    }
  }
  return { ok: true };
}

export function intakeToSitePlannerInput(
  intake: SiteBuilderIntakeFields,
  design: Pick<
    SitePlannerInput,
    "siteType" | "styleIntensity" | "web3VisualMode" | "layoutVariantIndex"
  > & {
    designDirection?: SitePlannerInput["designDirection"];
    widgetKey?: SitePlannerInput["widgetKey"];
    widgetPlacement?: SitePlannerInput["widgetPlacement"];
  },
): SitePlannerInput {
  const baseNarrative = buildNarrativeFromIntake(intake).trim() || " ";
  const styleHint = {
    designDirection: design.designDirection,
    styleIntensity: design.styleIntensity,
    web3VisualMode: design.web3VisualMode,
    siteType: String(design.siteType),
  };
  const userPrompt = buildCinematicNarrativeEnrichment(
    baseNarrative,
    intake,
    styleHint,
    baseNarrative,
  )
    .trim()
    .slice(0, 8000);
  return {
    userPrompt: userPrompt.length ? userPrompt : " ",
    siteType: design.siteType,
    styleIntensity: design.styleIntensity,
    web3VisualMode: design.web3VisualMode,
    designDirection: design.designDirection,
    industry: intake.industry.trim() || undefined,
    market: intake.market.trim() || undefined,
    businessName: intake.businessName.trim() || undefined,
    primaryOffer: intake.primaryOffer.trim() || undefined,
    audience: intake.audience.trim() || undefined,
    layoutVariantIndex: design.layoutVariantIndex,
    widgetKey: design.widgetKey,
    widgetPlacement: design.widgetPlacement,
    statedConversionGoal: intake.conversionGoal.trim() || undefined,
    statedBrandTone: intake.brandTone.trim() || undefined,
    statedDesignPreference: intake.designPreference.trim() || undefined,
    statedTrustAndProof: intake.trustAndProof.trim() || undefined,
  };
}

/** Keys for the progressive (one-at-a-time) assistant intake — order is fixed. */
export const CONVERSATIONAL_INTAKE_STEP_KEYS = [
  "businessName",
  "industry",
  "primaryOffer",
  "audience",
  "conversionGoal",
  "brandTone",
  "designPreference",
  "inspirationWebsites",
  "trustAndProof",
] as const;

export type ConversationalIntakeStepKey = (typeof CONVERSATIONAL_INTAKE_STEP_KEYS)[number];

const INTAKE_STEP_PROMPTS: Record<ConversationalIntakeStepKey, string> = {
  businessName: "What is the business or brand name?",
  industry: "What industry or niche are you in?",
  primaryOffer: "What is the primary offer, product, or main service?",
  audience: "Who is the target audience (role, need, or segment)?",
  conversionGoal: "What should visitors do first (book, buy, sign up, contact, etc.)?",
  brandTone: "What tone should the copy use (e.g. formal, friendly, technical, premium)?",
  designPreference: "Any design preference (e.g. minimal, bold, luxe, lots of white space, dark mode)?",
  inspirationWebsites: "Inspiration sites (one URL per line) — we use layout/tone patterns only, not their text.",
  trustAndProof: "What trust or proof should we feature (awards, years in business, logos, testimonials, compliance)?",
};

export function getConversationalIntakeStepPrompt(key: ConversationalIntakeStepKey): string {
  return INTAKE_STEP_PROMPTS[key];
}

/**
 * Returns the first unanswered step, plus progress counts.
 * A step is “complete” if it has a non-empty answer or was skipped.
 */
export function getNextConversationalIntakeStep(
  answers: Partial<Record<ConversationalIntakeStepKey, string>>,
  skipped: ReadonlyArray<ConversationalIntakeStepKey>,
): {
  key: ConversationalIntakeStepKey;
  prompt: string;
  /** Steps already answered or skipped (before the current question). */
  completedBefore: number;
  total: number;
} | null {
  const total = CONVERSATIONAL_INTAKE_STEP_KEYS.length;
  for (const k of CONVERSATIONAL_INTAKE_STEP_KEYS) {
    const done = skipped.includes(k) || Boolean((answers[k] ?? "").trim().length);
    if (!done) {
      const completedBefore = CONVERSATIONAL_INTAKE_STEP_KEYS.filter((x) => {
        if (x === k) return false;
        return skipped.includes(x) || Boolean((answers[x] ?? "").trim().length);
      }).length;
      return {
        key: k,
        prompt: getConversationalIntakeStepPrompt(k),
        completedBefore,
        total,
      };
    }
  }
  return null;
}

export function conversationalIntakeProgress(
  answers: Partial<Record<ConversationalIntakeStepKey, string>>,
  skipped: ReadonlyArray<ConversationalIntakeStepKey>,
): { completed: number; total: number } {
  const total = CONVERSATIONAL_INTAKE_STEP_KEYS.length;
  const completed = CONVERSATIONAL_INTAKE_STEP_KEYS.filter(
    (k) => skipped.includes(k) || Boolean((answers[k] ?? "").trim().length),
  ).length;
  return { completed, total };
}
