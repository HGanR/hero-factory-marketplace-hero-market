import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";
import {
  extractOffersFromIntake,
  getConversionChecklist,
  getHeroEnhancementHints,
  getIndustryPromptTemplate,
  getLocalBusinessOptimizationHints,
  getMobileFirstRecommendations,
  planIndustrySections,
  resolveBusinessArchetype,
  suggestPrimaryCtas,
  suggestTrustSignals,
  type SiteBuilderBusinessArchetype,
} from "@/lib/fulfillment/site-builder-industry-templates";
import type { RevisionIntent } from "@/lib/fulfillment/revision-intelligence";
import type { DraftVersionComparison } from "@/lib/fulfillment/revision-delta-summary";
import type { WebsiteIntakeNormalized, WebsiteIntakeReadiness } from "@/lib/fulfillment/website-intake-types";

export type StructuredSiteBuilderBriefInput = {
  normalized: WebsiteIntakeNormalized;
  readiness: WebsiteIntakeReadiness;
  salesSummary?: string | null;
  revisionIntent?: RevisionIntent | null;
  versionComparison?: DraftVersionComparison | null;
  draftVersion?: number;
};

function section(title: string, lines: (string | null)[]): string {
  const body = lines.filter((l): l is string => Boolean(l?.trim()));
  if (!body.length) return "";
  return `## ${title}\n${body.join("\n")}`;
}

function list(label: string, items: string[]): string | null {
  if (!items.length) return null;
  return `${label}:\n${items.map((i) => `- ${redactSensitiveIntakeText(i)}`).join("\n")}`;
}

export function buildStructuredSiteBuilderBrief(input: StructuredSiteBuilderBriefInput): string {
  const { normalized: profile, readiness } = input;
  const archetype: SiteBuilderBusinessArchetype = resolveBusinessArchetype(profile);
  const template = getIndustryPromptTemplate(archetype);
  const sectionPlan = planIndustrySections(archetype, profile);
  const ctas = suggestPrimaryCtas(archetype, profile);
  const trust = suggestTrustSignals(archetype, profile);
  const offers = extractOffersFromIntake(profile, input.salesSummary);
  const heroHints = getHeroEnhancementHints(archetype, profile);
  const localHints = getLocalBusinessOptimizationHints(archetype, profile);
  const mobileRecs = getMobileFirstRecommendations(profile);
  const checklist = getConversionChecklist(archetype);

  const versionLabel = input.draftVersion && input.draftVersion > 1 ? ` · draft v${input.draftVersion}` : "";

  const blocks = [
    `[Structured Site Builder brief · ${archetype.replace(/_/g, " ")} · readiness ${readiness.score}%${versionLabel}]`,
    section("Business snapshot", [
      profile.businessName ? `Name: ${redactSensitiveIntakeText(profile.businessName)}` : null,
      profile.businessType ? `Type: ${redactSensitiveIntakeText(profile.businessType)}` : null,
      profile.industry || profile.niche
        ? `Industry: ${redactSensitiveIntakeText(profile.industry ?? profile.niche ?? "")}`
        : null,
      profile.targetAudience ? `Audience: ${redactSensitiveIntakeText(profile.targetAudience)}` : null,
      list("Goals", profile.websiteGoals),
    ]),
    section("Voice & positioning", [
      `Tone: ${template.tone}`,
      list("Emphasize", template.emphasis),
      list("Avoid", template.avoid),
    ]),
    section("Section plan", [
      list("Recommended sections", sectionPlan.recommendedSections),
      list("Optional sections", sectionPlan.optionalSections),
      list("Planning notes", sectionPlan.planningNotes),
    ]),
    section("Hero & primary CTA", [
      list("Hero enhancements", heroHints),
      list("Primary CTA options (pick one)", ctas),
      profile.primaryCTA ? `Client-requested CTA: ${redactSensitiveIntakeText(profile.primaryCTA)}` : null,
    ]),
    section("Offers & conversion", [
      list("Offers to surface", offers),
      list("Conversion checklist (draft must satisfy)", checklist.map((c) => c.label)),
    ]),
    section("Trust signals", [list("Use or adapt", trust)]),
    section("Local & mobile", [
      list("Local business", localHints),
      list("Mobile-first", mobileRecs),
    ]),
  ];

  if (input.revisionIntent && input.revisionIntent.sourceCount > 0) {
    blocks.push(
      section("Revision intent (apply on this draft)", [
        `Summary: ${input.revisionIntent.summary}`,
        list("Themes", input.revisionIntent.themes.map((t) => t.replace(/_/g, " "))),
        list("Priorities", input.revisionIntent.priorities),
      ])
    );
  }

  if (input.versionComparison?.hasComparison) {
    blocks.push(
      section("Version comparison", [
        input.versionComparison.summary,
        list("Improvements", input.versionComparison.improvements),
        list("Watch", input.versionComparison.regressions),
      ])
    );
  }

  if (readiness.missingFields.length) {
    blocks.push(section("Intake gaps to infer carefully", [list("Missing", readiness.missingFields)]));
  }

  blocks.push(
    "[Fulfillment guardrails]",
    "Internal Site Builder note only on approval.",
    "No deploy, publish, email, SMS, or autonomous release.",
  );

  return blocks.filter(Boolean).join("\n\n").slice(0, 20_000);
}
