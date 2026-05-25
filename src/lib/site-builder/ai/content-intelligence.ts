import { ContentBriefSchema, type ContentBrief } from "@/lib/site-builder/ai/content-brief-schema";
import {
  CONTENT_REPAIR_SCORE_THRESHOLD,
  scoreContentQuality,
  shouldRepairContent,
  type ContentQualityResult,
} from "@/lib/site-builder/ai/content-quality";
import type { SitePlannerInput, SitePlannerOutput, SiteIntent } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const COPY_KEYS = new Set([
  "title",
  "subtitle",
  "headline",
  "subheadline",
  "description",
  "body",
  "text",
  "label",
  "primaryCta",
  "secondaryCta",
  "ctaLabel",
  "eyebrow",
  "kicker",
]);

/**
 * Remove immediate duplicate word runs and short repeated phrases (e.g. "A A", "X Y X Y").
 */
export function dedupeRepeatedPhrases(s: string): string {
  if (!s || typeof s !== "string") return s;
  let t = s.replace(/\b(\S+)(?:\s+\1\b){1,3}/gi, "$1");
  t = t.replace(/(\b[\w']{2,20}\b(?:\s+[\w']{2,20}){1,5})\s+\1\b/gi, "$1");
  t = t.replace(/(\b[\w']{2,30}\b(?:\s+[\w']{2,20}){0,4}\s+)(?=\1)/gi, "");
  t = t.replace(/(\b[\w'’-]{3,40}\b(?:\s+[\w'’-]{2,36}){1,8})\s+\1\b/gi, "$1");
  return t.replace(/\s{2,}/g, " ").trim();
}

function inferIntentLabel(intent: SiteIntent | string): string {
  const m: Record<string, string> = {
    web3_product: "Web3 product / protocol",
    saas: "B2B SaaS",
    local_business: "Local business",
    landing: "Service business",
    portfolio: "Creator / portfolio",
    community: "Community / membership",
    ecommerce_light: "E-commerce",
    trust_operator: "Trust / governance",
  };
  return m[String(intent)] ?? "Business";
}

function extractPainFromPrompt(p: string): string[] {
  const out: string[] = [];
  const low = p.toLowerCase();
  if (/slow|inefficien|fragment|compliance|risk|security|uncertain|waste|costly/.test(low)) {
    if (/fragment|silo|tool/.test(low)) out.push("Fragmented tools and unclear workflow");
    if (/compliance|risk|audit/.test(low)) out.push("Compliance and operational risk");
    if (/scale|grow|revenue|pipeline/.test(low)) out.push("Scaling without losing quality");
  }
  if (out.length === 0) {
    out.push("Clarity and trust in a crowded market", "A partner who ships outcomes, not slide decks");
  }
  return out.slice(0, 4);
}

function keywordSeedsForIntent(intent: SiteIntent | string, industry: string, web3: boolean): string[] {
  const ind = (industry || "").toLowerCase();
  const base: string[] = [];
  if (String(intent) === "web3_product" || web3) {
    base.push("on-chain", "wallet", "governance", "allowlist", "mainnet", "security");
  }
  if (/blockchain|web3|crypto|defi|dao/.test(ind)) {
    base.push("blockchain", "Web3", "smart contract", "token");
  }
  if (/consult|advis|law|accounting|professional/.test(ind)) {
    base.push("advisory", "engagement", "outcomes", "governance", "stakeholder");
  }
  if (ind) base.push(...ind.split(/[^a-z0-9+]+/i).filter((w) => w.length > 3).slice(0, 4));
  return [...new Set(base)].filter(Boolean).slice(0, 12);
}

/**
 * Build a working content brief from intake + optional planner output.
 */
export function buildContentBrief(
  input: SitePlannerInput,
  planner?: SitePlannerOutput,
): ContentBrief {
  const prompt = input.userPrompt?.trim() || "";
  const industry = (input.industry || planner?.normalizedBrief || "").trim().slice(0, 200);
  const businessName = input.businessName?.trim() || undefined;
  const web3 = Boolean(input.web3VisualMode || planner?.intent === "web3_product");
  const intent = (planner?.intent ?? (input.siteType === "auto" ? "landing" : input.siteType)) as SiteIntent;

  const audience =
    input.audience?.trim() ||
    (industry ? `Teams and leaders in ${industry.split(/[,;]/)[0]!.trim()}` : "Primary buyers and operators");

  const plannerGoal = planner?.conversionGoal?.trim();
  const statedGoal = input.statedConversionGoal?.trim();
  const primaryOffer =
    input.primaryOffer?.trim() ||
    (plannerGoal && plannerGoal.length >= 20 ? plannerGoal : undefined) ||
    (industry
      ? `Strategic ${industry} programs with clear milestones and measurable ROI`
      : "Outcome-led consulting with a practical delivery plan");

  const painPoints = extractPainFromPrompt(prompt);
  const conversionGoal =
    statedGoal ||
    planner?.conversionGoal ||
    (web3 ? "Move qualified users to the next on-chain or product action" : "Book a strategy call and confirm fit");

  const toneInsp = input.inspirationBrief?.tone
    ? input.inspirationBrief.tone.replace(/\s+/g, " ").trim().slice(0, 200)
    : "";
  const statedTone = input.statedBrandTone?.trim();
  const tone =
    statedTone && statedTone.length > 2
      ? statedTone.slice(0, 200)
      : toneInsp && toneInsp.length > 8
        ? toneInsp
        : planner?.brandVoice?.tone || (web3 ? "Credible, security-conscious" : "Direct, partner-led, evidence-driven");

  const trustFromIntake = input.statedTrustAndProof
    ? input.statedTrustAndProof
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2)
        .slice(0, 6)
    : [];
  const trustSignals: string[] = [
    ...trustFromIntake,
    ...(planner?.brandVoice?.keywords?.slice(0, 4) ?? []),
    industry ? `Experience in ${industry.split(/[,;]/)[0]!.trim()}` : "Proven delivery cadence",
    "Clear scope, milestones, and success criteria",
  ].filter(Boolean);

  let ctaPrimary = web3 ? "Join the allowlist" : "Book a 20‑min consult";
  if (statedGoal && statedGoal.length >= 4 && statedGoal.length < 120) {
    ctaPrimary = statedGoal.slice(0, 100);
  }
  const ctaSecondary = web3 ? "View security posture" : "Get the engagement menu";

  const desiredOutcome = web3
    ? "Users understand value, risk posture, and the next safe step"
    : "Visitors book a call with confidence in the offer and process";

  const businessType = inferIntentLabel(intent);

  const baseKeywords = keywordSeedsForIntent(intent, industry, web3);
  const fromInsp = input.inspirationBrief?.keywordThemes;
  const brief: ContentBrief = {
    businessType,
    industry: industry || "General",
    audience,
    primaryOffer,
    painPoints,
    desiredOutcome,
    tone,
    trustSignals: [
      ...new Set([...trustSignals, ...(input.inspirationBrief?.trustSignals ?? []).map((s) => s.slice(0, 200))]),
    ]
      .filter(Boolean)
      .slice(0, 8),
    conversionGoal,
    ctaPrimary,
    ctaSecondary,
    keywordTargets: (fromInsp && fromInsp.length
      ? [
          ...fromInsp.map((k) => String(k).trim().slice(0, 64)).filter(Boolean),
          ...baseKeywords,
        ]
      : baseKeywords
    ).filter(Boolean)
      .slice(0, 12),
  };
  if (businessName) {
    brief.keywordTargets = [businessName, ...brief.keywordTargets!].filter(Boolean).slice(0, 12);
  }
  return ContentBriefSchema.parse(brief);
}

type MutableBlock = SiteSchemaDocumentType["pages"][number]["blocks"][number];

/**
 * Strengthen copy using the brief: hero, first CTAs, and dedupe.
 */
export function applyContentRepair(
  document: SiteSchemaDocumentType,
  brief: ContentBrief,
  _q: ContentQualityResult,
): SiteSchemaDocumentType {
  const d = document as unknown as { pages: typeof document.pages; metadata: typeof document.metadata };
  const md = d.metadata;
  if (!md) return document;
  if (md.title) md.title = dedupeRepeatedPhrases(String(md.title));
  if (md.description) md.description = dedupeRepeatedPhrases(String(md.description));

  const first = d.pages[0];
  if (!first?.blocks?.length) return document;

  for (const block of first.blocks as MutableBlock[]) {
    const c = block.content;
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    for (const key of Object.keys(o)) {
      if (typeof o[key] === "string") {
        o[key] = dedupeRepeatedPhrases(String(o[key]));
      }
    }

    if (block.type === "hero") {
      if (typeof o.title === "string" && o.title) {
        const t = o.title as string;
        if (VAGUE_HEADLINE.test(t) || REPEAT_INDUSTRY.test(t) || t.length < 20) {
          o.title = `Outcome-led ${brief.industry ? brief.industry : "advisory"} without the noise`;
        }
        o.title = dedupeRepeatedPhrases(String(o.title));
        if (brief.primaryOffer) {
          const p = brief.primaryOffer.slice(0, 100);
          if (t.length < 32 && (!o.subtitle || String(o.subtitle).length < 20)) {
            o.subtitle = p;
          }
        }
      }
      if (typeof o.subtitle === "string") {
        o.subtitle = dedupeRepeatedPhrases(
          o.subtitle.length < 20 ? String(brief.painPoints[0] ?? o.subtitle) : String(o.subtitle),
        );
      }
      if (GENERIC_LEARN.test(String(o.primaryCta || "")))
        o.primaryCta = brief.ctaPrimary || (o.primaryCta as string);
      if (o.secondaryCta != null && GENERIC_LEARN.test(String(o.secondaryCta)))
        o.secondaryCta = brief.ctaSecondary;
    }
    if (block.type === "button" && typeof o.label === "string" && GENERIC_LEARN.test(String(o.label))) {
      o.label = brief.ctaPrimary || o.label;
    }
    if (block.type === "call_to_action" && typeof o.headline === "string") {
      o.headline = dedupeRepeatedPhrases(String(o.headline));
    }
  }
  return document;
}

const VAGUE_HEADLINE = /\b(professional services|solutions? and advisory|advisory and)\b/i;
const REPEAT_INDUSTRY = /(\b\w+\s+\w+\b)\s+\1/i;
const GENERIC_LEARN = /^learn more$/i;

/**
 * Heuristic: scan block content and repair strings; second pass = dedupe.
 */
function repairAllStringsInDocument(
  document: SiteSchemaDocumentType,
  replacer: (k: string, s: string) => string,
): void {
  for (const p of document.pages) {
    for (const b of p.blocks) {
      const c = b.content;
      if (!c || typeof c !== "object") continue;
      const o = c as Record<string, unknown>;
      for (const key of Object.keys(o)) {
        if (COPY_KEYS.has(key) && typeof o[key] === "string") {
          o[key] = replacer(key, String(o[key]));
        } else if (key === "bullets" && Array.isArray(o[key])) {
          o[key] = (o[key] as unknown[]).map((x) =>
            typeof x === "string" ? replacer("bullet", x) : x,
          ) as unknown[];
        }
      }
    }
  }
}

export type ContentIntelligenceMeta = {
  contentScore: number;
  repaired: boolean;
  issues: string[];
  brief: Pick<
    ContentBrief,
    "industry" | "audience" | "primaryOffer" | "tone" | "keywordTargets" | "ctaPrimary"
  >;
};

export function runContentIntelligencePipeline(
  input: SitePlannerInput,
  planner: SitePlannerOutput,
  document: SiteSchemaDocumentType,
): { document: SiteSchemaDocumentType; meta: ContentIntelligenceMeta } {
  const brief = buildContentBrief(input, planner);
  let working = document;
  const first = scoreContentQuality(working, brief);
  let repaired = false;
  if (shouldRepairContent(first.score)) {
    working = applyContentRepair(working, brief, first);
    repairAllStringsInDocument(working, (_k, s) => dedupeRepeatedPhrases(s));
    repaired = true;
  } else {
    repairAllStringsInDocument(working, (_k, s) => dedupeRepeatedPhrases(s));
  }
  const finalQ = scoreContentQuality(working, brief);
  return {
    document: working,
    meta: {
      contentScore: finalQ.score,
      repaired,
      issues: [...new Set([...first.issues, ...finalQ.issues])].slice(0, 20),
      brief: {
        industry: brief.industry,
        audience: brief.audience,
        primaryOffer: brief.primaryOffer,
        tone: brief.tone,
        keywordTargets: brief.keywordTargets,
        ctaPrimary: brief.ctaPrimary,
      },
    },
  };
}
