import type { TrustProfile, OfferingType } from "./types";

export type RuleResult = {
  // offering requirements
  requiresPPM: boolean;
  allowedOfferingTypes: OfferingType[];
  disallowedReasons: string[];

  // gating requirements
  mustBeExecutedToOpen: boolean;
  mustHaveMinutesAuthorizationToOpen: boolean;
  mustHaveFinalPPMToOpen: boolean;

  // UI display rules
  showAccreditedFlow: boolean;
  showDonationFlow: boolean;
  showCharitableDisclosures: boolean;
};

export function evaluateOfferingRules(profile: TrustProfile): RuleResult {
  const reasons: string[] = [];

  // Map actual database trust types to our logical categories
  const trustKind = profile.trustKind;
  const isCharitable = trustKind === "revocable_living_trust" || profile.isCharitable === true; // Assume revocable might be used for charitable
  const isFoundation = profile.isFoundation === true;
  const isSpecialPurpose = trustKind === "special_purpose_trust";

  // Default: private placement / notes / units for most trusts
  let allowedOfferingTypes: RuleResult["allowedOfferingTypes"] = [
    "private_placement",
    "subscription_note",
    "membership_units",
  ];

  // For special purpose trusts, allow donation programs
  if (isSpecialPurpose || isCharitable) {
    allowedOfferingTypes = ["donation_program", "subscription_note", "membership_units"];
  }

  // PPM requirement:
  // - For securities offerings: yes
  // - For donation programs: no (disclosures instead)
  const requiresPPM = !isCharitable; // conservative default

  // Gating:
  const mustBeExecutedToOpen = profile.status !== "executed"; // counsel-friendly: do not "open" until trust executed
  const mustHaveMinutesAuthorizationToOpen = true;
  const mustHaveFinalPPMToOpen = requiresPPM;

  // UI toggles
  const showAccreditedFlow = !isCharitable; // typical securities gating; donation flows differ
  const showDonationFlow = isCharitable || isSpecialPurpose;
  const showCharitableDisclosures = isCharitable || isSpecialPurpose;

  // Disallow reasons (examples)
  if (profile.status !== "executed" && profile.status !== "approved") {
    reasons.push("Trust must be approved or executed before creating offerings.");
  }

  return {
    requiresPPM,
    allowedOfferingTypes,
    disallowedReasons: reasons,
    mustBeExecutedToOpen,
    mustHaveMinutesAuthorizationToOpen,
    mustHaveFinalPPMToOpen,
    showAccreditedFlow,
    showDonationFlow,
    showCharitableDisclosures,
  };
}
