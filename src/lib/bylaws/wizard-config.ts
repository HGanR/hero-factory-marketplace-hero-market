// Bylaws Wizard Configuration
// Step-by-step wizard for creating state-compliant bylaws

// Using our own step config for bylaws wizard
interface BylawStepConfig {
  id: string;
  title: string;
  description: string;
  validationRules?: any[];
  uiComponents: any[];
}
import { BYLAW_RULESETS, getRulesetForState, BylawClause, EntityForm } from "./rulesets";

export type BylawsWizardStep =
  | "entity-gatekeeper"
  | "state-selection"
  | "core-clauses"
  | "board-governance"
  | "officer-roles"
  | "meetings-voting"
  | "committees-policies"
  | "protector-integration"
  | "review-validation";

export type GovernancePackage =
  | "none"
  | "bylaws_standard"
  | "bylaws_foundation"
  | "bylaws_religious"
  | "bylaws_family_office";

export type BylawsDraft = {
  // Entity context
  entityType: string;
  entityForm: EntityForm;
  state: string;
  governancePackage: GovernancePackage;
  memberStructure?: "member" | "non_member";

  // Ruleset
  rulesetId?: string;

  // Clause content
  clauses: Record<string, {
    enabled: boolean;
    content: string;
    customContent?: boolean;
  }>;

  // Governance settings
  directorCount: number;
  quorumPercentage: number;
  noticeDays: number;
  amendmentThreshold: number;

  // IRS suggestions
  includeIrsPurpose: boolean;
  includeIrsDissolution: boolean;

  // Trust Protector integration
  includeProtector: boolean;
  protectorPowers?: string[];

  // Legal disclaimer
  acceptDisclaimer?: boolean;
};

export const BYLAWS_WIZARD_STEPS: BylawStepConfig[] = [
  {
    id: "entity-gatekeeper",
    title: "Entity & Formation Context",
    description: "Determine if bylaws are needed and select your formation details",
    uiComponents: [
      {
        type: "select",
        field: "entityType",
        label: "Entity Type",
        options: ["foundation", "religious_organization", "family_office"],
        required: true
      },
      {
        type: "select",
        field: "entityForm",
        label: "Legal Form",
        options: ["nonprofit_corp", "religious_corp", "llc"],
        required: true
      },
      {
        type: "select",
        field: "state",
        label: "State of Formation",
        options: ["TX", "DE", "CA"], // Pilot states
        required: true
      },
      {
        type: "select",
        field: "memberStructure",
        label: "Member Structure (if applicable)",
        options: ["member", "non_member"],
        required: false
      }
    ]
  },

  {
    id: "state-selection",
    title: "State-Specific Rules",
    description: "Review legal requirements for your selected state and entity form",
    validationRules: [
      { kind: "required", field: "rulesetId", message: "State ruleset must be selected" }
    ],
    uiComponents: [
      {
        type: "asset-editor", // Custom component to show rules summary
        field: "rulesSummary",
        label: "State Requirements Summary",
        required: true
      },
      {
        type: "checkbox",
        field: "acceptDisclaimer",
        label: "I acknowledge this is general guidance, not legal advice",
        required: true
      }
    ]
  },

  {
    id: "core-clauses",
    title: "Core Provisions",
    description: "Basic organizational clauses required by law",
    validationRules: [
      { kind: "required", field: "clauses.name-purpose.content", message: "Name and purpose clause is required" }
    ],
    uiComponents: [
      {
        type: "certificate-builder", // Custom component for clause editing
        field: "clauses.name-purpose",
        label: "Name and Purpose",
        required: true
      },
      {
        type: "certificate-builder",
        field: "clauses.religious-purpose",
        label: "Religious Purpose (if applicable)",
        required: false
      },
      {
        type: "checkbox",
        field: "includeIrsPurpose",
        label: "Include IRS-suggested purpose language",
        required: false
      }
    ]
  },

  {
    id: "board-governance",
    title: "Board Composition & Governance",
    description: "Director requirements, terms, and qualifications",
    validationRules: [
      { kind: "requiresAuthority", message: "Director count must meet state minimum requirements" }
    ],
    uiComponents: [
      {
        type: "input",
        field: "directorCount",
        label: "Number of Directors",
        inputType: "number",
        required: true
      },
      {
        type: "certificate-builder",
        field: "clauses.board-composition",
        label: "Board Composition Clause",
        required: true
      },
      {
        type: "certificate-builder",
        field: "clauses.committees",
        label: "Committees (Optional)",
        required: false
      }
    ]
  },

  {
    id: "officer-roles",
    title: "Officers & Leadership",
    description: "Required officer positions and their duties",
    uiComponents: [
      {
        type: "certificate-builder",
        field: "clauses.officer-roles",
        label: "Officer Roles & Duties",
        required: true
      },
      {
        type: "certificate-builder",
        field: "clauses.doctrinal-oversight",
        label: "Doctrinal Oversight (Religious Orgs)",
        required: false
      }
    ]
  },

  {
    id: "meetings-voting",
    title: "Meetings & Voting Procedures",
    description: "Meeting requirements, notice, quorum, and voting rules",
    validationRules: [
      { kind: "requiresAuthority", message: "Quorum percentage must meet state minimums" }
    ],
    uiComponents: [
      {
        type: "certificate-builder",
        field: "clauses.meetings-quorum",
        label: "Meetings & Quorum",
        required: true
      },
      {
        type: "input",
        field: "quorumPercentage",
        label: "Voting Quorum (%)",
        inputType: "number",
        required: true
      },
      {
        type: "input",
        field: "noticeDays",
        label: "Meeting Notice (days)",
        inputType: "number",
        required: true
      }
    ]
  },

  {
    id: "committees-policies",
    title: "Policies & Procedures",
    description: "Additional governance policies and procedures",
    uiComponents: [
      {
        type: "certificate-builder",
        field: "clauses.conflicts-interest",
        label: "Conflicts of Interest Policy",
        required: false
      },
      {
        type: "certificate-builder",
        field: "clauses.indemnification",
        label: "Indemnification",
        required: false
      },
      {
        type: "certificate-builder",
        field: "clauses.records-inspection",
        label: "Records & Inspection Rights",
        required: false
      }
    ]
  },

  {
    id: "protector-integration",
    title: "Trust Protector Integration",
    description: "Optional integration with Trust Protector governance",
    uiComponents: [
      {
        type: "checkbox",
        field: "includeProtector",
        label: "Include Trust Protector references",
        required: false
      },
      {
        type: "multi-checkbox",
        field: "protectorPowers",
        label: "Protector Powers to Reference",
        options: [
          { value: "purpose_enforcement", label: "Purpose enforcement" },
          { value: "director_removal", label: "Director removal/appointment" },
          { value: "extraordinary_actions", label: "Approval of extraordinary actions" },
          { value: "doctrinal_compliance", label: "Doctrinal compliance (religious orgs)" }
        ],
        required: false
      }
    ]
  },

  {
    id: "review-validation",
    title: "Review & Validation",
    description: "Review your bylaws and validate against state requirements",
    uiComponents: [
      {
        type: "certificate-builder",
        field: "clauses.amendment-procedure",
        label: "Amendment Procedure",
        required: true
      },
      {
        type: "certificate-builder",
        field: "clauses.dissolution",
        label: "Dissolution Clause",
        required: true
      },
      {
        type: "checkbox",
        field: "includeIrsDissolution",
        label: "Include IRS-suggested dissolution language",
        required: false
      },
      {
        type: "package-builder", // Custom component for validation summary
        field: "validationSummary",
        label: "Validation Summary",
        required: true
      }
    ]
  }
];

// Helper functions
export function shouldShowBylawsWizard(entityType: string, entityForm?: string, governancePackage?: GovernancePackage): boolean {
  if (governancePackage && governancePackage !== "none") return true;

  // Bylaws needed for corporate forms, not trusts
  if (entityForm === "trust") return false;

  // Bylaws needed for corporations and LLCs
  if (["nonprofit_corp", "religious_corp", "llc"].includes(entityForm || "")) return true;

  // For foundations and religious orgs, depends on incorporation status
  return true; // Default to showing - let wizard determine
}

export function getAvailableClausesForRuleset(rulesetId: string): BylawClause[] {
  const ruleset = BYLAW_RULESETS.find(r => r.id === rulesetId);
  return ruleset?.availableClauses || [];
}

export function getStatutoryMinimums(rulesetId: string) {
  const ruleset = BYLAW_RULESETS.find(r => r.id === rulesetId);
  return ruleset?.statutoryMinimums || {
    minimumDirectors: 1,
    quorumFloor: 50,
    noticeRequirement: 10
  };
}

export function generateDefaultBylawsDraft(
  entityType: string,
  entityForm: EntityForm,
  state: string,
  governancePackage: GovernancePackage
): BylawsDraft {
  const ruleset = getRulesetForState(state, entityForm);

  return {
    entityType: entityType as any,
    entityForm,
    state,
    governancePackage,
    rulesetId: ruleset?.id,

    clauses: {}, // Will be populated based on available clauses

    directorCount: ruleset?.statutoryMinimums.minimumDirectors || 3,
    quorumPercentage: 50,
    noticeDays: ruleset?.statutoryMinimums.noticeRequirement || 10,
    amendmentThreshold: 66,

    includeIrsPurpose: false,
    includeIrsDissolution: false,

    includeProtector: false
  };
}
