// Religious Organization Wizard Types
// Based on the comprehensive blueprint provided

export type USState =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA"
  | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD"
  | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ"
  | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC"
  | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

export type ReligiousOrgForm = "unincorporated" | "nonprofit_corporation" | "religious_corporation";

export type ReligiousOrgAffiliation =
  | "standalone"
  | "affiliated_to_trust"
  | "affiliated_to_family_office"
  | "affiliated_to_foundation"
  | "dao_wrapper_support";

export type ReligiousOrgPreset =
  | "standard"
  | "bank_ready"
  | "trust_affiliated"
  | "dao_ready"
  | "custom";

export type ReligiousOrgModule =
  | "founding_docs"
  | "governance"
  | "state_readiness"
  | "bylaws_or_policy"
  | "ein"
  | "banking_pack"
  | "donations"
  | "records"
  | "affiliations";

export type WizardStep =
  | "setup"
  | "onboarding"
  | "mission"
  | "governance"
  | "state_requirements"
  | "bylaws_or_policy"
  | "ein"
  | "banking"
  | "donations"
  | "records"
  | "review";

export type RequirementLevel = "required" | "recommended" | "optional" | "not_allowed";

export type HelpBadge = {
  level: RequirementLevel;
  label: string; // short label shown in UI
  detail?: string; // longer help text
  sourceHint?: string; // e.g. "State default" / "Common banking expectation"
};

export type ValidationIssue = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export type UIComponent =
  | { type: "select"; field: string; label: string; options: { value: string; label: string; helpText?: string }[]; required?: boolean; helpText?: string; badge?: HelpBadge }
  | { type: "input"; field: string; label: string; placeholder?: string; required?: boolean; inputType?: "text" | "number" | "date"; helpText?: string; badge?: HelpBadge }
  | { type: "textarea"; field: string; label: string; placeholder?: string; required?: boolean; rows?: number; helpText?: string; badge?: HelpBadge }
  | { type: "checkbox"; field: string; label: string; required?: boolean; helpText?: string; badge?: HelpBadge }
  | { type: "multi-checkbox"; field: string; label: string; options: { value: string; label: string; helpText?: string; badge?: HelpBadge }[]; required?: boolean; helpText?: string; badge?: HelpBadge }
  | { type: "divider"; label?: string }
  | { type: "callout"; tone: "info" | "warning" | "danger"; title: string; body: string };

export type StepConfig = {
  id: WizardStep;
  title: string;
  description: string;
  uiComponents: UIComponent[];
  /** Optional gate: step is only relevant when predicate true */
  when?: (draft: ReligiousOrgDraft) => boolean;
  /** Optional validation per step */
  validate?: (draft: ReligiousOrgDraft) => ValidationResult;
};

export type StateRule = {
  state: USState;
  /** Human-readable notes shown in State Requirements step */
  overview: string[];
  /** Minimum recommended/required governance characteristics (objective constraints only) */
  constraints: {
    /** Minimum governing body size if incorporated (null means not enforced by ruleset) */
    minGoverningBodySize?: number | null;
    /** Quorum floor if you choose to set quorum in bylaws (null means not enforced) */
    quorumFloorPct?: number | null;
    /** Notes about state-specific requirements */
    notes?: string[];
  };
  /** Per-field badges/help: attach to specific wizard fields */
  fieldHelp: Partial<Record<keyof ReligiousOrgDraft, HelpBadge>>;
  /** Clause-level notes (used inside Bylaws step) */
  bylawsHelp: {
    quorum: HelpBadge;
    dissolution: HelpBadge;
    conflictPolicy: HelpBadge;
    memberStructure: HelpBadge;
  };
};

// Draft model for Religious Organization
export type ReligiousOrgDraft = {
  // Core identity
  orgName: string;
  formationState: USState | "";
  orgForm: ReligiousOrgForm;
  affiliation: ReligiousOrgAffiliation;

  // Onboarding controls
  preset: ReligiousOrgPreset;
  selectedModules: ReligiousOrgModule[];

  // Mission / doctrine
  statementOfFaith: string;
  purposeStatement: string;
  primaryActivities: string;

  // Governance
  governanceModel: "board_of_directors" | "elders" | "trustees" | "hybrid";
  directorsOrTrusteesCount: number | null;
  officerStructure: "standard_officers" | "custom";
  officers: { title: string; duties: string }[];

  // State readiness
  registeredAgentPlanned: boolean;
  initialMeetingPlanned: boolean;

  // Bylaws or governance policy
  governancePolicyMode: "bylaws" | "policy"; // derived from orgForm but can be overridden for unincorp
  memberStructure: "non_member" | "member" | "unknown";
  quorumPct: number | null; // 1..100
  conflictPolicyAdopted: boolean;
  dissolutionClauseIncluded: boolean;

  // EIN & banking
  hasEIN: boolean;
  einLast4: string;
  signatoryRule: "single_signer" | "two_signers_over_threshold";
  twoSignerThresholdUSD: number | null;
  bankingReady: boolean;

  // Donations
  donationReceipting: boolean;
  restrictedFunds: boolean;
  restrictedFundExamples: string; // comma/newline separated

  // Records
  minutesCadence: "monthly" | "quarterly" | "annually" | "as_needed";
  recordkeepingPlan: string;

  // Meta
  draftVersion: number;
};
