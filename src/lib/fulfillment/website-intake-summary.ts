import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";
import { normalizeWebsiteIntake, parseWebsiteIntakeFromHandoffJson } from "@/lib/fulfillment/website-intake-normalizer";
import { scoreWebsiteIntakeReadiness } from "@/lib/fulfillment/website-intake-readiness";
import type {
  WebsiteIntakeNormalized,
  WebsiteIntakePackage,
  WebsiteIntakeReadiness,
  WebsiteIntakeSnapshot,
} from "@/lib/fulfillment/website-intake-types";

function line(label: string, value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  return `${label}: ${redactSensitiveIntakeText(t)}`;
}

function listLine(label: string, items: string[]): string | null {
  if (!items.length) return null;
  return `${label}: ${items.map((i) => redactSensitiveIntakeText(i)).join("; ")}`;
}

function formatContact(profile: WebsiteIntakeNormalized): string | null {
  const c = profile.contactInfo;
  if (!c) return null;
  const parts = [
    c.email ? `email ${redactSensitiveIntakeText(c.email)}` : null,
    c.phone ? `phone ${redactSensitiveIntakeText(c.phone)}` : null,
    c.website ? `web ${redactSensitiveIntakeText(c.website)}` : null,
  ].filter((p): p is string => p != null);
  return parts.length ? `Contact: ${parts.join(" · ")}` : null;
}

function formatSocial(profile: WebsiteIntakeNormalized): string | null {
  if (!profile.socialLinks.length) return null;
  const parts = profile.socialLinks.map((s) => `${s.platform} (${s.url.slice(0, 80)})`);
  return `Social: ${parts.join("; ")}`;
}

export function buildSkipperIntakeSummary(
  profile: WebsiteIntakeNormalized,
  readiness: WebsiteIntakeReadiness
): string {
  const rows = [
    `[WEBSITE intake — ${readiness.tier.toUpperCase()} · score ${readiness.score}/100 · ${
      readiness.fulfillmentReady ? "fulfillment-ready" : "not ready"
    }]`,
    line("Business", profile.businessName),
    line("Type", profile.businessType),
    line("Industry", profile.industry ?? profile.niche),
    line("Audience", profile.targetAudience),
    listLine("Pages", profile.desiredPages),
    listLine("Goals", profile.websiteGoals),
    listLine("Colors", profile.colorPreferences),
    listLine("Style", profile.stylePreferences),
    line("Primary CTA", profile.primaryCTA),
    formatContact(profile),
    formatSocial(profile),
    profile.bookingNeeded != null ? `Booking needed: ${profile.bookingNeeded ? "yes" : "no"}` : null,
    profile.ecommerceNeeded != null ? `E-commerce needed: ${profile.ecommerceNeeded ? "yes" : "no"}` : null,
    listLine("Trust signals", profile.trustSignals),
    listLine("References", profile.referenceSites),
    profile.launchUrgency ? `Launch urgency: ${profile.launchUrgency}` : null,
    readiness.missingFields.length
      ? `Missing: ${readiness.missingFields.join(", ")}`
      : "Missing: none flagged",
  ].filter((r): r is string => r != null);

  return rows.join("\n").slice(0, 12_000);
}

export function buildSiteBuilderIntakeBrief(
  profile: WebsiteIntakeNormalized,
  readiness: WebsiteIntakeReadiness
): string {
  const header = `[Site Builder intake brief · ${readiness.tier} · readiness ${readiness.score}%]`;
  const body = buildSkipperIntakeSummary(profile, readiness);
  return `${header}\n${body}`.slice(0, 20_000);
}

export function buildWebsiteIntakePackage(input: {
  websiteIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): WebsiteIntakePackage {
  const normalized = normalizeWebsiteIntake(input);
  const readiness = scoreWebsiteIntakeReadiness(normalized);
  const skipperSummary = buildSkipperIntakeSummary(normalized, readiness);
  const siteBuilderBrief = buildSiteBuilderIntakeBrief(normalized, readiness);
  return { normalized, readiness, skipperSummary, siteBuilderBrief };
}

export function buildWebsiteIntakeSnapshot(input: {
  websiteIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): WebsiteIntakeSnapshot {
  const pkg = buildWebsiteIntakePackage(input);
  return {
    normalized: pkg.normalized,
    readiness: pkg.readiness,
    skipperSummary: pkg.skipperSummary,
    siteBuilderBrief: pkg.siteBuilderBrief,
  };
}

export function loadWebsiteIntakeFromOrder(input: {
  executiveHandoffJson?: string | null;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): WebsiteIntakePackage {
  if (input.executiveHandoffJson?.trim()) {
    try {
      const handoff = JSON.parse(input.executiveHandoffJson) as {
        intake?: WebsiteIntakeSnapshot;
        websiteIntake?: unknown;
      };
      if (handoff.intake?.normalized && handoff.intake?.readiness) {
        return {
          normalized: handoff.intake.normalized,
          readiness: handoff.intake.readiness,
          skipperSummary: handoff.intake.skipperSummary,
          siteBuilderBrief: handoff.intake.siteBuilderBrief,
        };
      }
      const websiteIntake = handoff.websiteIntake ?? parseWebsiteIntakeFromHandoffJson(input.executiveHandoffJson);
      return buildWebsiteIntakePackage({
        websiteIntake,
        salesSummaryText: input.salesSummaryText,
        requestedDeliverableJson: input.requestedDeliverableJson,
      });
    } catch {
      /* fall through */
    }
  }

  return buildWebsiteIntakePackage({
    salesSummaryText: input.salesSummaryText,
    requestedDeliverableJson: input.requestedDeliverableJson,
  });
}

export function excerptText(text: string, max = 480): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
