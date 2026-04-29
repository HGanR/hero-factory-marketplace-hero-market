import { TrustClassification } from "@/config/trustDefaults";
import { EntityType, validateEntityAttachment, validateCommercialTrustConfiguration } from "@/lib/entityEligibility";

/**
 * API Validation Guards (Non-Negotiable)
 * These functions enforce the canonical trust taxonomy rules at the API level.
 */

export class TrustValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public requirements?: string[]
  ) {
    super(message);
    this.name = "TrustValidationError";
  }
}

/**
 * Validate entity attachment at API level
 * Called when attempting to attach/link an entity to a trust
 */
export function validateEntityAttachmentForTrust(
  trust: TrustClassification,
  entityType: EntityType
): void {
  try {
    validateEntityAttachment(trust, entityType);
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      throw error; // Re-throw EntityAttachmentError
    }
    throw new TrustValidationError(
      "ENTITY_ATTACHMENT_VALIDATION_FAILED",
      `Entity attachment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate trust configuration for commercial activity
 * Called when creating or updating trust with commercialEnabled = true
 */
export function validateCommercialTrustSetup(trust: TrustClassification): void {
  try {
    validateCommercialTrustConfiguration(trust);
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      throw error; // Re-throw EntityAttachmentError
    }
    throw new TrustValidationError(
      "COMMERCIAL_TRUST_VALIDATION_FAILED",
      `Commercial trust validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate S Corporation attachment specifically
 * Additional guard for the most restrictive entity type
 */
export function validateSCorporationAttachment(trust: TrustClassification): void {
  if (!trust.sCorpEligible) {
    throw new TrustValidationError(
      "S_CORP_INELIGIBLE_TRUST",
      "Trust does not qualify to own an S Corporation under IRS rules",
      [
        "Trust must qualify as Grantor Trust, QSST, or ESBT",
        "IRS election confirmation required",
        "Legal counsel review required"
      ]
    );
  }

  if (!["grantor", "QSST", "ESBT"].includes(trust.trustSubtype)) {
    throw new TrustValidationError(
      "INVALID_S_CORP_TRUST_SUBTYPE",
      "Trust subtype does not qualify for S Corporation ownership",
      ["Trust subtype must be 'grantor', 'QSST', or 'ESBT'"]
    );
  }

  if (!trust.irsElectionConfirmed) {
    throw new TrustValidationError(
      "IRS_ELECTION_NOT_CONFIRMED",
      "IRS election confirmation required for S Corporation ownership",
      ["IRS election must be confirmed before S Corp attachment"]
    );
  }
}

/**
 * Validate trust creation/update against canonical rules
 * Master validation function for trust operations
 */
export function validateTrustOperation(
  trust: TrustClassification,
  operation: "create" | "update" | "entity_attachment",
  entityType?: EntityType
): void {

  // All platform trusts must be express by default
  if (trust.formationMode !== "express") {
    throw new TrustValidationError(
      "INVALID_FORMATION_MODE",
      "All platform trusts must be formed as express trusts",
      ["formationMode must be 'express'"]
    );
  }

  // Commercial trusts require complex governance
  if (trust.commercialEnabled && trust.governanceMode !== "complex") {
    throw new TrustValidationError(
      "INVALID_COMMERCIAL_TRUST_SETUP",
      "Commercial trusts require complex governance enforcement",
      ["governanceMode must be 'complex' when commercialEnabled is true"]
    );
  }

  // Entity attachment validation
  if (operation === "entity_attachment" && entityType) {
    validateEntityAttachmentForTrust(trust, entityType);

    // Extra validation for S Corps
    if (entityType === "s_corporation") {
      validateSCorporationAttachment(trust);
    }
  }
}

/**
 * Helper to check if a trust is a "Private Express Trust"
 * Matches the canonical definition exactly
 */
export function isPrivateExpressTrust(trust: TrustClassification): boolean {
  return (
    trust.trustCategory === "private" &&
    trust.formationMode === "express" &&
    trust.commercialEnabled === true &&
    trust.governanceMode === "complex"
  );
}