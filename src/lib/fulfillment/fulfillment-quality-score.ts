import {
  getConversionChecklist,
  resolveBusinessArchetype,
  suggestPrimaryCtas,
  suggestTrustSignals,
} from "@/lib/fulfillment/site-builder-industry-templates";
import { compareDraftVersions, type DraftVersionComparison } from "@/lib/fulfillment/revision-delta-summary";
import {
  collectRevisionNotesFromEvents,
  extractRevisionIntent,
  type RevisionIntent,
} from "@/lib/fulfillment/revision-intelligence";
import { parseSiteBuilderNoteFields } from "@/lib/fulfillment/fulfillment-deliverable-draft-parse";
import type { WebsiteIntakeNormalized, WebsiteIntakeReadiness } from "@/lib/fulfillment/website-intake-types";

export type ConversionReadinessTier = "low" | "medium" | "high";

export type ConversionChecklistResult = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
};

export type FulfillmentDraftQualityDto = {
  draftQualityScore: number;
  conversionReadiness: ConversionReadinessTier;
  missingBusinessSignals: string[];
  weakCtaWarnings: string[];
  conversionChecklist: ConversionChecklistResult[];
  revisionIntentSummary: string | null;
  revisionThemes: string[];
  versionComparison: DraftVersionComparison | null;
  businessArchetype: string;
  recommendedCtas: string[];
};

export type BuildDraftQualityInput = {
  normalized: WebsiteIntakeNormalized;
  readiness: WebsiteIntakeReadiness;
  draftNoteText: string | null;
  draftVersion?: number;
  priorDraftNoteText?: string | null;
  orderEvents?: Array<{ payloadJson: string | null }>;
};

const WEAK_CTA_PATTERNS = [
  /\b(click here|learn more|submit|read more)\b/i,
  /\b(lorem|placeholder|todo|tbd)\b/i,
];

export function scoreDraftQuality(input: BuildDraftQualityInput): FulfillmentDraftQualityDto {
  const archetype = resolveBusinessArchetype(input.normalized);
  const checklistDefs = getConversionChecklist(archetype);
  const recommendedCtas = suggestPrimaryCtas(archetype, input.normalized);
  const draftBody = input.draftNoteText
    ? parseSiteBuilderNoteFields(input.draftNoteText).body
    : "";
  const combined = `${draftBody}\n${input.normalized.primaryCTA ?? ""}`.toLowerCase();

  const revisionNotes = collectRevisionNotesFromEvents(input.orderEvents ?? []);
  const revisionIntent: RevisionIntent = extractRevisionIntent(revisionNotes);

  const versionComparison =
    input.draftVersion && input.draftVersion > 1 && input.priorDraftNoteText
      ? compareDraftVersions({
          previousBody: parseSiteBuilderNoteFields(input.priorDraftNoteText).body,
          currentBody: draftBody,
          currentVersion: input.draftVersion,
          previousVersion: input.draftVersion - 1,
          revisionIntent,
        })
      : input.draftVersion && input.draftVersion > 1
        ? compareDraftVersions({
            previousBody: null,
            currentBody: draftBody,
            currentVersion: input.draftVersion,
            revisionIntent,
          })
        : null;

  const conversionChecklist = evaluateChecklist(checklistDefs, draftBody, input.normalized);
  const checklistScore = conversionChecklist.reduce(
    (sum, c) => sum + (c.passed ? c.weight : 0),
    0
  );
  const checklistMax = conversionChecklist.reduce((sum, c) => sum + c.weight, 0) || 1;

  const intakeComponent = Math.round(input.readiness.score * 0.35);
  const draftComponent = draftBody.trim()
    ? Math.round((checklistScore / checklistMax) * 45)
    : 0;
  const revisionBonus =
    revisionIntent.sourceCount > 0 && draftBody.trim() ? 5 : 0;
  const versionBonus = versionComparison?.hasComparison && versionComparison.improvements.length ? 5 : 0;

  const draftQualityScore = Math.min(
    100,
    intakeComponent + draftComponent + revisionBonus + versionBonus + (draftBody.trim() ? 10 : 0)
  );

  const conversionReadiness = toConversionTier(draftQualityScore, checklistScore / checklistMax);

  return {
    draftQualityScore,
    conversionReadiness,
    missingBusinessSignals: collectMissingSignals(input.normalized, draftBody),
    weakCtaWarnings: detectWeakCtaWarnings(draftBody, recommendedCtas),
    conversionChecklist,
    revisionIntentSummary: revisionIntent.sourceCount ? revisionIntent.summary : null,
    revisionThemes: revisionIntent.themes,
    versionComparison,
    businessArchetype: archetype,
    recommendedCtas,
  };
}

function evaluateChecklist(
  defs: ReturnType<typeof getConversionChecklist>,
  draftBody: string,
  profile: WebsiteIntakeNormalized
): ConversionChecklistResult[] {
  const text = draftBody.toLowerCase();
  return defs.map((def) => {
    let passed = false;
    switch (def.id) {
      case "hero_cta":
        passed = /\b(call|book|schedule|quote|order|contact|get started|reserve)\b/i.test(text);
        break;
      case "value_prop":
        passed = text.length > 120;
        break;
      case "trust_proof":
        passed =
          /\b(review|testimonial|trusted|years|certified|insured|rating|client)\b/i.test(text) ||
          profile.trustSignals.length > 0;
        break;
      case "contact_path":
        passed =
          Boolean(profile.contactInfo?.phone || profile.contactInfo?.email) ||
          /\b(contact|phone|email|form)\b/i.test(text);
        break;
      case "mobile_cta":
        passed = /\b(mobile|call|tap|phone)\b/i.test(text) || Boolean(profile.contactInfo?.phone);
        break;
      case "offer_clarity":
        passed = /\b(free|off|save|package|offer|promo)\b/i.test(text) || profile.websiteGoals.length > 0;
        break;
      case "service_area":
        passed = /\b(area|city|local|serve|neighborhood)\b/i.test(text);
        break;
      case "credentials":
        passed = /\b(certified|licensed|degree|experience|award)\b/i.test(text);
        break;
      case "hours_menu":
        passed = /\b(menu|hours|dine|order)\b/i.test(text);
        break;
      case "product_grid":
        passed = /\b(product|shop|collection|catalog)\b/i.test(text);
        break;
      case "booking":
        passed = profile.bookingNeeded === true || /\b(book|appointment)\b/i.test(text);
        break;
      case "portfolio":
        passed = /\b(portfolio|gallery|work|case study)\b/i.test(text);
        break;
      default:
        passed = text.includes(def.label.toLowerCase().slice(0, 8));
    }
    return { id: def.id, label: def.label, passed, weight: def.weight };
  });
}

function collectMissingSignals(profile: WebsiteIntakeNormalized, draftBody: string): string[] {
  const missing: string[] = [];
  if (!profile.businessName) missing.push("business name");
  if (!profile.businessType && !profile.industry && !profile.niche) missing.push("business category");
  if (!profile.targetAudience) missing.push("target audience");
  if (!profile.websiteGoals.length) missing.push("website goals");
  if (!profile.primaryCTA && !/\b(call|book|contact|quote)\b/i.test(draftBody)) missing.push("primary CTA");
  if (!profile.contactInfo?.phone && !profile.contactInfo?.email) missing.push("contact path");
  if (!profile.trustSignals.length && !/\b(review|testimonial|trust)\b/i.test(draftBody)) {
    missing.push("trust proof");
  }
  const expectedTrust = suggestTrustSignals(resolveBusinessArchetype(profile), profile);
  if (expectedTrust.length && !draftBody.trim()) missing.push("draft body not linked yet");
  return missing;
}

function detectWeakCtaWarnings(draftBody: string, recommended: string[]): string[] {
  const warnings: string[] = [];
  for (const pat of WEAK_CTA_PATTERNS) {
    if (pat.test(draftBody)) warnings.push(`Generic or placeholder CTA language detected (${pat.source}).`);
  }
  const hasStrong = recommended.some((c) => draftBody.toLowerCase().includes(c.toLowerCase().slice(0, 8)));
  if (draftBody.trim() && !hasStrong) {
    warnings.push(`Draft may not use a recommended CTA (${recommended[0]}).`);
  }
  if (draftBody.split(/\b(call|book|contact)\b/gi).length > 4) {
    warnings.push("Multiple competing CTAs — pick one primary action.");
  }
  return [...new Set(warnings)].slice(0, 6);
}

function toConversionTier(score: number, checklistRatio: number): ConversionReadinessTier {
  if (score >= 75 && checklistRatio >= 0.7) return "high";
  if (score >= 50 && checklistRatio >= 0.45) return "medium";
  return "low";
}
