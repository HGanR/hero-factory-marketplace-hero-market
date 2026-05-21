import { evaluateJarvaIntakeReadiness } from "@/lib/jarva/jarva-readiness";
import { normalizedToJarvaIntake } from "@/lib/fulfillment/trust-intake-normalizer";
import type {
  TrustIntakeNormalized,
  TrustIntakeReadiness,
  TrustIntakeReadinessTier,
} from "@/lib/fulfillment/trust-intake-types";

export function scoreTrustIntakeReadiness(profile: TrustIntakeNormalized): TrustIntakeReadiness {
  const jarva = normalizedToJarvaIntake(profile);
  const jarvaReadiness = evaluateJarvaIntakeReadiness(jarva);

  const presentFields: string[] = [];
  const missingFields = [...jarvaReadiness.missing];

  if (profile.trustPurpose) presentFields.push("trustPurpose");
  else missingFields.push("Trust purpose / objectives");

  if (profile.grantorName) presentFields.push("grantor");
  if (profile.trusteeName) presentFields.push("trustee");
  if (profile.jurisdictionState) presentFields.push("jurisdictionState");
  if (profile.beneficiariesSummary) presentFields.push("beneficiariesSummary");
  if (profile.assetCategories.length) presentFields.push("assetCategories");
  if (profile.familyBusinessContext) presentFields.push("familyBusinessContext");

  const legalAdvisories = [
    ...jarvaReadiness.advisories,
    "Output is prepared for legal review only — not a final legal document.",
    "Recommend licensed attorney review in the governing jurisdiction.",
  ];

  if (!profile.existingDocuments.attorneyEngaged) {
    legalAdvisories.push("No attorney engagement captured — confirm counsel review path.");
  }
  if (profile.existingDocuments.hasPourOverWill) {
    legalAdvisories.push("Pour-over will coordination noted — counsel should align estate documents.");
  }
  if (jarvaReadiness.blockers.length) {
    legalAdvisories.push(...jarvaReadiness.blockers.map((b) => `Structural blocker: ${b}`));
  }

  const score = Math.min(
    100,
    Math.round(
      jarvaReadiness.ok ? 55 + presentFields.length * 5 : 20 + presentFields.length * 4
    )
  );

  let tier: TrustIntakeReadinessTier = "weak";
  if (score >= 75 && jarvaReadiness.ok) tier = "strong";
  else if (score >= 50) tier = "medium";

  const fulfillmentReady =
    jarvaReadiness.ok &&
    Boolean(profile.trustPurpose) &&
    Boolean(profile.jurisdictionState);

  return {
    tier,
    score,
    fulfillmentReady,
    missingFields: [...new Set(missingFields)],
    presentFields,
    legalAdvisories: [...new Set(legalAdvisories)].slice(0, 12),
  };
}
