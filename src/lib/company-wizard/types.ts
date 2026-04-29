// Parent Company + C-Corp Wizard Types
// Based on the comprehensive blueprint

export type USState =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA"
  | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD"
  | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ"
  | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC"
  | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

export type CompanyKind = "parent_holding_company" | "operating_company";
export type CorpType = "c_corp" | "s_corp" | "llc" | "unknown";
export type ParentStructure = "single_parent_single_sub" | "single_parent_multi_sub" | "parent_only" | "unknown";

export type ParentCorpPreset =
  | "standard_delaware_c_corp"
  | "holding_company_with_operating_sub"
  | "bank_ready"
  | "custom";

export type ParentCorpModule =
  | "formation"
  | "governance"
  | "equity"
  | "banking"
  | "ip"
  | "subsidiaries"
  | "compliance";

export type WizardStep =
  | "structure_builder"
  | "setup"
  | "onboarding"
  | "formation"
  | "governance"
  | "equity"
  | "subsidiaries"
  | "ip"
  | "banking"
  | "compliance"
  | "review";

export type RequirementLevel = "required" | "recommended" | "optional" | "not_allowed";

export type HelpBadge = {
  level: RequirementLevel;
  label: string;
  detail?: string;
  sourceHint?: string;
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
  when?: (draft: ParentCorpDraft) => boolean;
  validate?: (draft: ParentCorpDraft) => ValidationResult;
};

export type StateRule = {
  state: USState;
  overview: string[];
  fieldHelp: Partial<Record<keyof ParentCorpDraft, HelpBadge>>;
};

export type Founder = {
  name: string;
  email?: string;
  role?: string;
  equityPct?: number | null;
};

export type SubsidiaryPlan = {
  name: string;
  kind: "operating" | "ip_holdco" | "real_estate" | "other";
  state?: USState | "";
  notes?: string;
};

export type ParentCorpDraft = {
  // Setup
  companyName: string;
  formationState: USState | "";
  companyKind: CompanyKind;
  corpType: CorpType;
  parentStructure: ParentStructure;

  // Structure builder
  structureChoice: string;

  // Onboarding controls
  preset: ParentCorpPreset;
  selectedModules: ParentCorpModule[];

  // Formation inputs
  registeredAgentPlanned: boolean;
  authorizedShares: number | null;
  parValue: number | null;
  fiscalYearEndMonth: number | null;

  // Governance
  boardSize: number | null;
  officersPlanned: boolean;
  initialBoardConsentPlanned: boolean;

  // Equity / cap table
  founders: Founder[];
  founderIssuancePlanned: boolean;
  optionPoolPlanned: boolean;
  optionPoolPct: number | null;
  vestingStandard: boolean;

  // Subsidiaries
  subsidiaries: SubsidiaryPlan[];
  parentOwns100Pct: boolean;

  // IP
  ipAssignmentPlanned: boolean;
  inventionsAssignmentPlanned: boolean;

  // Banking
  einPlanned: boolean;
  bankingReady: boolean;
  signatoryRule: "single_signer" | "two_signers_over_threshold";
  twoSignerThresholdUSD: number | null;

  // Compliance (high level)
  annualReportPlanned: boolean;
  franchiseTaxAwareness: boolean;

  // Meta
  draftVersion: number;
};
