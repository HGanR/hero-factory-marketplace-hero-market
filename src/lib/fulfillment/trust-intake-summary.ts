import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";
import { normalizeTrustIntake } from "@/lib/fulfillment/trust-intake-normalizer";
import { scoreTrustIntakeReadiness } from "@/lib/fulfillment/trust-intake-readiness";
import { TRUST_FULFILLMENT_SKIPPER_WARNING } from "@/lib/fulfillment/fulfillment-trust-legal";
import type {
  TrustIntakeNormalized,
  TrustIntakePackage,
  TrustIntakeReadiness,
  TrustIntakeSnapshot,
} from "@/lib/fulfillment/trust-intake-types";

function line(label: string, value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  return `${label}: ${redactSensitiveIntakeText(t)}`;
}

export function buildSkipperTrustIntakeSummary(
  profile: TrustIntakeNormalized,
  readiness: TrustIntakeReadiness
): string {
  const rows = [
    `[TRUST intake — ${readiness.tier.toUpperCase()} · score ${readiness.score}/100 · ${
      readiness.fulfillmentReady ? "fulfillment-ready" : "not ready"
    }]`,
    line("Purpose", profile.trustPurpose),
    line("Grantor", profile.grantorName),
    line("Trustee", profile.trusteeName),
    line("Beneficiaries", profile.beneficiariesSummary),
    line("Jurisdiction", profile.jurisdictionState),
    line("Urgency", profile.urgency),
    line("Family/business context", profile.familyBusinessContext),
    profile.assetCategories.length
      ? `Asset categories: ${profile.assetCategories.join("; ")}`
      : null,
    line("Desired package", profile.desiredOutputPackage),
    readiness.missingFields.length
      ? `Missing: ${readiness.missingFields.join(", ")}`
      : "Missing: none flagged",
    readiness.legalAdvisories.length
      ? `Legal advisories: ${readiness.legalAdvisories.slice(0, 3).join(" · ")}`
      : null,
    TRUST_FULFILLMENT_SKIPPER_WARNING,
  ].filter((r): r is string => r != null);

  return rows.join("\n").slice(0, 12_000);
}

export function buildTrustFulfillmentBrief(
  profile: TrustIntakeNormalized,
  readiness: TrustIntakeReadiness
): string {
  const header = `[Trust fulfillment brief · ${readiness.tier} · readiness ${readiness.score}%]`;
  return `${header}\n${buildSkipperTrustIntakeSummary(profile, readiness)}`.slice(0, 20_000);
}

export function buildTrustIntakePackage(input: {
  trustIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): TrustIntakePackage {
  const normalized = normalizeTrustIntake(input);
  const readiness = scoreTrustIntakeReadiness(normalized);
  return {
    normalized,
    readiness,
    skipperSummary: buildSkipperTrustIntakeSummary(normalized, readiness),
    trustBrief: buildTrustFulfillmentBrief(normalized, readiness),
  };
}

export function buildTrustIntakeSnapshot(input: {
  trustIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): TrustIntakeSnapshot {
  const pkg = buildTrustIntakePackage(input);
  return {
    normalized: pkg.normalized,
    readiness: pkg.readiness,
    skipperSummary: pkg.skipperSummary,
    trustBrief: pkg.trustBrief,
  };
}

export function loadTrustIntakeFromOrder(input: {
  executiveHandoffJson?: string | null;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): TrustIntakePackage {
  if (input.executiveHandoffJson?.trim()) {
    try {
      const handoff = JSON.parse(input.executiveHandoffJson) as {
        intake?: TrustIntakeSnapshot;
        trustIntake?: unknown;
      };
      if (handoff.intake?.normalized && handoff.intake?.readiness) {
        return {
          normalized: handoff.intake.normalized,
          readiness: handoff.intake.readiness,
          skipperSummary: handoff.intake.skipperSummary,
          trustBrief: handoff.intake.trustBrief,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return buildTrustIntakePackage({
    trustIntake: undefined,
    salesSummaryText: input.salesSummaryText,
    requestedDeliverableJson: input.requestedDeliverableJson,
  });
}
