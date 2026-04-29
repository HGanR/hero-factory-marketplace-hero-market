import { z } from "zod";

/**
 * Family Office Playbook v1
 * - Jurisdiction selection
 * - Entity stack builder
 * - Governance configuration
 * - Service modules
 * - Export readiness gating
 */

/* ---------------------------- Enums / Primitives --------------------------- */

export const FamilyOfficeTriggerEventEnum = z.enum([
  "liquidity_event_sale",
  "inheritance",
  "gradual_accumulation",
  "operating_company_dividend_stream",
  "other",
]);

export const FamilyOfficeScopeEnum = z.enum([
  "single_household",
  "multi_household_single_branch",
  "multi_branch",
  "multi_generation",
]);

export const AssetComplexityEnum = z.enum([
  "domestic_simple",
  "domestic_complex",
  "multi_jurisdiction",
  "alts_heavy",
  "digital_assets_heavy",
]);

export const ControlStyleEnum = z.enum([
  "founder_led",
  "family_council_led",
  "trustee_led",
  "cio_led",
  "hybrid",
]);

export const TransparencyPreferenceEnum = z.enum([
  "high_transparency",
  "moderate_transparency",
  "privacy_but_compliant",
]);

export const FamilyOfficeModelEnum = z.enum([
  "service_only",
  "holding_and_service",
  "trust_or_foundation_owned",
  "hybrid_with_side_pools",
]);

export const EntityTypeEnum = z.enum([
  "ownership_trust",
  "ownership_foundation",
  "family_office_operating_company",
  "holding_company",
  "spv_real_estate",
  "spv_private_equity",
  "spv_venture",
  "spv_digital_assets",
  "spv_other",
]);

export const LegalFormEnum = z.enum([
  "llc",
  "corporation",
  "partnership",
  "limited_partnership",
  "foundation",
  "trust",
  "other",
]);

export const DecisionDomainEnum = z.enum([
  "strategy",
  "investment_policy",
  "single_investment_approval",
  "manager_selection",
  "asset_sales",
  "distributions",
  "philanthropy",
  "budget",
  "hiring_firing",
  "constitutional_amendment",
]);

export const VotingRuleEnum = z.enum([
  "simple_majority",
  "super_majority_66",
  "super_majority_75",
  "unanimous",
  "role_based_no_vote",
]);

export const ConflictResolutionEnum = z.enum([
  "mediator",
  "arbitration",
  "family_council_vote",
  "trust_protector_decision",
  "court",
]);

export const ServiceModuleEnum = z.enum([
  "investment_management",
  "asset_reporting",
  "tax_legal_coordination",
  "philanthropy",
  "next_gen_education",
  "risk_management_insurance",
  "concierge",
]);

/* --------------------------- Core Identification --------------------------- */

export const JurisdictionSchema = z.object({
  country: z.string().min(2),
  regionState: z.string().optional(),
  city: z.string().optional(),
  familyMembersPrimaryLocations: z.array(z.string()).min(1),
  coreAssetLocations: z.array(z.string()).min(1),
  requiresTrustRecognition: z.boolean().default(true),
  requiresFoundationOption: z.boolean().default(false),
  transparencyPreference: TransparencyPreferenceEnum,
  selectedJurisdictionCode: z.string().min(2),
  notes: z.string().optional(),
});

export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

/* ------------------------------ Intake / Scope ----------------------------- */

export const FamilyOfficeIntakeSchema = z.object({
  triggerEvent: FamilyOfficeTriggerEventEnum,
  triggerEventOtherText: z.string().optional(),
  scope: FamilyOfficeScopeEnum,
  assetComplexity: AssetComplexityEnum,
  controlStyle: ControlStyleEnum,
  householdsCount: z.number().int().positive().optional(),
  generationsServed: z.number().int().positive().optional(),
  recommendedModel: FamilyOfficeModelEnum.optional(),
});

export type FamilyOfficeIntake = z.infer<typeof FamilyOfficeIntakeSchema>;

/* ------------------------------ Entity Stack ------------------------------- */

export const EntityNodeSchema = z.object({
  id: z.string().min(6),
  type: EntityTypeEnum,
  name: z.string().min(2),
  jurisdictionCode: z.string().min(2),
  legalForm: LegalFormEnum,
  isPrimary: z.boolean().default(false),
  ownedByEntityId: z.string().min(6).optional(),
  managesEntityIds: z.array(z.string().min(6)).default([]),
  notes: z.string().optional(),
});

export type EntityNode = z.infer<typeof EntityNodeSchema>;

export const EntityGraphSchema = z.object({
  model: FamilyOfficeModelEnum,
  entities: z.array(EntityNodeSchema).min(1),
  ownershipEntityId: z.string().min(6),
  operatingCompanyEntityId: z.string().min(6),
  holdingCompanyEntityId: z.string().min(6).optional(),
  sidePoolEntityIds: z.array(z.string().min(6)).default([]),
});

export type EntityGraph = z.infer<typeof EntityGraphSchema>;

/* ------------------------------ Governance -------------------------------- */

export const RoleEnum = z.enum([
  "founder",
  "family_member",
  "family_council",
  "advisory_council",
  "investment_committee",
  "cio",
  "ceo_family_office",
  "trustee",
  "trust_protector",
  "external_advisor",
]);

export const GovernanceBodySchema = z.object({
  id: z.string().min(6),
  role: RoleEnum,
  name: z.string().min(2),
  memberIds: z.array(z.string().min(2)).min(1),
  description: z.string().optional(),
});

export type GovernanceBody = z.infer<typeof GovernanceBodySchema>;

export const DecisionRightSchema = z.object({
  domain: DecisionDomainEnum,
  proposerBodyIds: z.array(z.string().min(6)).min(1),
  approverBodyIds: z.array(z.string().min(6)).min(1),
  votingRule: VotingRuleEnum,
  quorumPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export type DecisionRight = z.infer<typeof DecisionRightSchema>;

export const GovernanceSchema = z.object({
  hasFamilyConstitution: z.boolean().default(false),
  bodies: z.array(GovernanceBodySchema).min(1),
  decisionRights: z.array(DecisionRightSchema).min(1),
  conflictResolution: ConflictResolutionEnum,
  successionPolicySummary: z.string().min(20).optional(),
  onChainGovernancePlanned: z.boolean().default(false),
  membershipNftPlanned: z.boolean().default(false),
});

export type Governance = z.infer<typeof GovernanceSchema>;

/* ---------------------------- Service Modules ----------------------------- */

export const ServiceModuleConfigSchema = z.object({
  enabled: z.boolean(),
  handledBy: z.enum(["in_house", "outsourced", "hybrid"]).optional(),
  notes: z.string().optional(),
});

export const ServiceMatrixSchema = z.object({
  modules: z.record(ServiceModuleEnum, ServiceModuleConfigSchema),
  feeModel: z.enum([
    "flat_family_assessment",
    "aum_based_internal",
    "cost_center_allocation",
    "hybrid",
  ]),
  disallowCommissions: z.boolean().default(true),
  feeNotes: z.string().optional(),
});

export type ServiceMatrix = z.infer<typeof ServiceMatrixSchema>;

/* --------------------------- Master Playbook State -------------------------- */

export const FamilyOfficePlaybookStateSchema = z.object({
  playbookId: z.literal("family_office_v1"),
  intake: FamilyOfficeIntakeSchema,
  jurisdiction: JurisdictionSchema,
  entityGraph: EntityGraphSchema,
  governance: GovernanceSchema,
  services: ServiceMatrixSchema,
  generatedArtifacts: z
    .object({
      familyOfficeCharterPdfId: z.string().optional(),
      familyConstitutionPdfId: z.string().optional(),
      governanceMemoPdfId: z.string().optional(),
      entityFormationPackId: z.string().optional(),
    })
    .optional(),
});

export type FamilyOfficePlaybookState = z.infer<typeof FamilyOfficePlaybookStateSchema>;

/* ------------------------------ Readiness --------------------------------- */

export const FamilyOfficeReadinessSchema = z.object({
  isReady: z.boolean(),
  blockers: z.array(z.string()),
  advisories: z.array(z.string()),
});

export type FamilyOfficeReadiness = z.infer<typeof FamilyOfficeReadinessSchema>;

export function evaluateFamilyOfficeReadiness(
  state: FamilyOfficePlaybookState
): FamilyOfficeReadiness {
  const blockers: string[] = [];
  const advisories: string[] = [];

  if (!state.jurisdiction.selectedJurisdictionCode) {
    blockers.push("Jurisdiction not selected.");
  }

  const ids = new Set(state.entityGraph.entities.map((e) => e.id));
  if (!ids.has(state.entityGraph.ownershipEntityId)) {
    blockers.push("Ownership entity missing (trust/foundation).");
  }
  if (!ids.has(state.entityGraph.operatingCompanyEntityId)) {
    blockers.push("Family office operating company entity missing.");
  }
  if (
    state.entityGraph.model !== "service_only" &&
    !state.entityGraph.holdingCompanyEntityId
  ) {
    blockers.push("Holding company entity required for selected model.");
  } else if (
    state.entityGraph.holdingCompanyEntityId &&
    !ids.has(state.entityGraph.holdingCompanyEntityId)
  ) {
    blockers.push("Holding company id references a missing entity.");
  }

  if (!state.governance.bodies?.length) blockers.push("Governance bodies not configured.");
  if (!state.governance.decisionRights?.length) {
    blockers.push("Decision rights matrix not configured.");
  }
  if (!state.governance.hasFamilyConstitution) {
    advisories.push("Family constitution not marked complete (recommended for export).");
  }

  if (!state.services.feeModel) blockers.push("Fee model not configured.");
  if (state.services.disallowCommissions !== true) {
    blockers.push("Commissions/retrocessions must be disallowed to avoid conflicts.");
  }

  const concierge = state.services.modules["concierge"];
  if (concierge?.enabled) {
    advisories.push("Concierge enabled: consider handling via back office or external provider.");
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    advisories,
  };
}
