import { TrustCategory, FormationMode, GovernanceMode, TrustSubtype, TrustClassification } from "@/config/trustDefaults";

export type EntityType = "c_corporation" | "s_corporation" | "llc" | "lp" | "llp";

export interface EntityEligibilityCheck {
  eligible: boolean;
  reason?: string;
  requirements?: string[];
  warnings?: string[];
}

/**
 * Canonical Entity Attachment Rules (Enforced at API + Wizard)
 */
export const ENTITY_ATTACHMENT_RULES = {
  c_corporation: {
    allowed: true,
    restrictions: "none",
    subsidiariesAllowed: true,
    requirements: []
  },
  llc: {
    allowed: true,
    restrictions: "none",
    subsidiariesAllowed: true,
    requirements: []
  },
  s_corporation: {
    allowed: "conditional",
    restrictions: "irs_compliance",
    subsidiariesAllowed: false, // Must preserve S status
    requirements: [
      "trustSubtype: 'grantor' | 'QSST' | 'ESBT'",
      "irsElectionConfirmed: true"
    ]
  },
  lp: {
    allowed: true,
    restrictions: "none",
    subsidiariesAllowed: true,
    requirements: []
  },
  llp: {
    allowed: true,
    restrictions: "none",
    subsidiariesAllowed: true,
    requirements: []
  }
} as const;

/**
 * Validates whether a trust can own a specific entity type
 */
export function checkEntityEligibility(
  trust: TrustClassification,
  entityType: EntityType
): EntityEligibilityCheck {

  // All entity types require express trust formation
  if (trust.formationMode !== "express") {
    return {
      eligible: false,
      reason: "Entity ownership requires an express trust (written instrument)",
      requirements: ["Trust must be formed as an express trust with written instrument"]
    };
  }

  // All entity types require commercial enablement
  if (!trust.commercialEnabled) {
    return {
      eligible: false,
      reason: "Entity ownership requires commercial activity enablement",
      requirements: ["Trust must have commercial activity enabled"]
    };
  }

  // Commercial trusts require complex governance enforcement
  if (trust.governanceMode !== "complex") {
    return {
      eligible: false,
      reason: "Commercial trusts require complex governance enforcement",
      requirements: ["Trust must have complex governance mode enabled"]
    };
  }

  // S Corporation has additional strict IRS requirements
  if (entityType === "s_corporation") {
    return checkSCorpEligibility(trust);
  }

  // C Corporations, LLCs, LPs, LLPs are eligible for Private Express Trusts
  return {
    eligible: true,
  };
}

/**
 * S Corporation Eligibility (IRS Compliance Guard)
 * S Corp may be owned by trust only if trust qualifies as:
 * - Grantor Trust
 * - QSST (Qualified Subchapter S Trust)
 * - ESBT (Electing Small Business Trust)
 */
function checkSCorpEligibility(trust: TrustClassification): EntityEligibilityCheck {
  const requirements = [
    "Trust must qualify as Grantor Trust, QSST, or ESBT per IRS rules",
    "Trust instrument must meet specific S Corp ownership requirements",
    "IRS election confirmation required",
    "Legal counsel review required for S Corp eligibility"
  ];

  // Must have S Corp eligibility flag set
  if (!trust.sCorpEligible) {
    return {
      eligible: false,
      reason: "Trust does not qualify to own an S Corporation under IRS rules",
      requirements,
      warnings: ["S Corporation ownership requires specialized trust structures"]
    };
  }

  // Must have qualifying subtype
  if (!["grantor", "QSST", "ESBT"].includes(trust.trustSubtype)) {
    return {
      eligible: false,
      reason: "Trust subtype does not qualify for S Corporation ownership",
      requirements,
      warnings: ["Only Grantor Trusts, QSST, or ESBT may own S Corporations"]
    };
  }

  // Must have IRS election confirmed
  if (!trust.irsElectionConfirmed) {
    return {
      eligible: false,
      reason: "IRS election confirmation required for S Corporation ownership",
      requirements,
      warnings: ["IRS election must be confirmed before S Corp attachment"]
    };
  }

  return {
    eligible: true,
  };
}

/**
 * Get user-friendly entity type display names
 */
export function getEntityTypeDisplayName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    c_corporation: "C Corporation",
    s_corporation: "S Corporation",
    llc: "Limited Liability Company (LLC)",
    lp: "Limited Partnership (LP)",
    llp: "Limited Liability Partnership (LLP)"
  };
  return names[entityType];
}

/**
 * Get entity ownership rules summary
 */
export function getEntityOwnershipRules(): Record<EntityType, string> {
  return {
    c_corporation: "Fully compatible - unlimited subsidiaries allowed",
    s_corporation: "Highly restrictive - requires specialized trust structures (QSST/ESBT) and IRS election",
    llc: "Fully compatible - may own subsidiaries and other entities",
    lp: "Compatible with proper trust structure",
    llp: "Compatible with proper trust structure"
  };
}

/**
 * API Validation Guards (Non-Negotiable)
 */
export class EntityAttachmentError extends Error {
  constructor(
    public code: string,
    message: string,
    public requirements?: string[]
  ) {
    super(message);
    this.name = "EntityAttachmentError";
  }
}

/**
 * Validate entity attachment at API level
 */
export function validateEntityAttachment(trust: TrustClassification, entityType: EntityType): void {
  const eligibility = checkEntityEligibility(trust, entityType);

  if (!eligibility.eligible) {
    throw new EntityAttachmentError(
      "INVALID_ENTITY_ATTACHMENT",
      eligibility.reason || "Entity attachment not allowed",
      eligibility.requirements
    );
  }
}

/**
 * Validate trust configuration for commercial activity
 */
export function validateCommercialTrustConfiguration(trust: TrustClassification): void {
  if (trust.commercialEnabled && trust.governanceMode !== "complex") {
    throw new EntityAttachmentError(
      "INVALID_TRUST_CONFIGURATION",
      "Commercial trusts require complex governance enforcement",
      ["governanceMode must be 'complex' when commercialEnabled is true"]
    );
  }
}