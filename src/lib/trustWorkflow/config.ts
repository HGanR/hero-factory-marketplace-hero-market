// Trust Workflow Wizard Configuration
// Frontend-renderable step configurations for the CID → TID → Asset → Certificate → Instruments → Package workflow

export type TrustWorkflowStep =
  | "context"
  | "client"
  | "trust_profile"
  | "trust_protector"
  | "authority"
  | "assets"
  | "certificates"
  | "instruments"
  | "package";

export type ValidationRule =
  | { kind: "required"; field: string; message: string }
  | { kind: "requiresAuthority"; message: string };

export type UIComponent =
  | { type: "select"; field: string; label: string; options: string[]; required?: boolean }
  | { type: "input"; field: string; label: string; placeholder?: string; required?: boolean; inputType?: "text" | "number" | "date" }
  | { type: "checkbox"; field: string; label: string; required?: boolean }
  | { type: "multi-checkbox"; field: string; label: string; options: { value: string; label: string }[]; required?: boolean }
  | { type: "asset-editor"; field: string; label: string; required?: boolean }
  | { type: "certificate-builder"; field: string; label: string; required?: boolean }
  | { type: "instrument-builder"; field: string; label: string; required?: boolean }
  | { type: "package-builder"; field: string; label: string; required?: boolean };

export type StepConfig = {
  id: TrustWorkflowStep;
  title: string;
  description: string;
  validationRules?: ValidationRule[];
  uiComponents: UIComponent[];
};

export const TRUST_WORKFLOW_STEPS: StepConfig[] = [
  {
    id: "context",
    title: "Entity Context",
    description: "Select whether this workflow is for a Trust, Family Office, or Charitable Trust.",
    uiComponents: [
      {
        type: "select",
        field: "entityContext",
        label: "Entity Type",
        options: ["trust", "family_office", "charitable_trust"],
        required: true,
      },
    ],
  },
  {
    id: "client",
    title: "Client Identity",
    description: "Assign or create the controlling party identity used for access, permissions, and audit history (CID).",
    uiComponents: [
      { type: "input", field: "client.fullName", label: "Full Legal Name", required: true },
      { type: "input", field: "client.email", label: "Email", required: true },
      {
        type: "select",
        field: "client.role",
        label: "Role",
        options: ["grantor_settlor", "trustee", "agent_poa", "family_office_manager", "counsel_reviewer"],
        required: true,
      },
    ],
    validationRules: [{ kind: "required", field: "client.email", message: "Email is required." }],
  },
  {
    id: "trust_profile",
    title: "Trust Profile",
    description: "Define the trust container and issue a Trust public identifier (TID) for instruments.",
    uiComponents: [
      { type: "input", field: "trust.name", label: "Trust Name", required: true },
      {
        type: "select",
        field: "trust.trustType",
        label: "Trust Type",
        options: ["revocable_living_trust", "irrevocable_trust", "testamentary_trust", "special_purpose_trust"],
        required: true,
      },
      { type: "input", field: "trust.jurisdictionState", label: "Jurisdiction State", required: true },
      { type: "input", field: "trust.governingLawState", label: "Governing Law State", required: true },
    ],
  },
  {
    id: "trust_protector",
    title: "Governance: Trust Protector",
    description: "Appoint an independent Trust Protector for oversight and structural governance.",
    validationRules: [{ kind: "required", field: "trustProtector.clientProfileId", message: "Trust Protector selection is required for revocable trusts" }],
    uiComponents: [
      {
        type: "select",
        field: "trustProtector.clientProfileId",
        label: "Select Trust Protector",
        options: [], // Will be populated dynamically from available client profiles
        required: true,
      },
      {
        type: "select",
        field: "trustProtector.activationMode",
        label: "Activation Mode",
        options: ["immediate", "upon_incapacity", "upon_death", "upon_irrevocable_conversion", "custom"],
        required: true,
      },
      {
        type: "input",
        field: "trustProtector.customTriggerDescription",
        label: "Custom Trigger Description",
        placeholder: "Describe when the Trust Protector should become active...",
        required: false,
      },
      {
        type: "multi-checkbox",
        field: "trustProtector.powers",
        label: "Granted Powers",
        required: true,
        options: [
          { value: "remove_replace_trustee", label: "Remove or replace trustee" },
          { value: "approve_trustee_resignation", label: "Approve trustee resignation" },
          { value: "resolve_ambiguities", label: "Resolve ambiguities in instrument" },
          { value: "approve_situs_change", label: "Approve situs/governing law change" },
          { value: "approve_decanting", label: "Approve decanting" },
          { value: "consent_administrative_amendments", label: "Consent to administrative amendments" },
          { value: "veto_extraordinary_transactions", label: "Veto extraordinary transactions (advanced)" },
        ],
      },
    ],
  },
  {
    id: "authority",
    title: "Trustee Authority",
    description: "Confirm that the trust instrument authorizes certification, collateralization, and instrument execution.",
    uiComponents: [
      {
        type: "multi-checkbox",
        field: "authority.checklist",
        label: "Required Trustee Powers",
        required: true,
        options: [
          { value: "certify_assets", label: "Certify trust-owned assets" },
          { value: "issue_certificates", label: "Issue asset-backed certificates" },
          { value: "pledge_encumber", label: "Pledge or encumber trust property" },
          { value: "notes_and_security_agreements", label: "Enter promissory notes and security agreements" },
          { value: "assign_income_streams", label: "Assign income streams without alienating corpus" },
          { value: "execute_financing_instruments", label: "Execute instruments for financing/capitalization/investment" },
        ],
      },
      { type: "checkbox", field: "authority.generateDraftAddendum", label: "Generate authority addendum (Draft/Review)" },
    ],
  },
  {
    id: "assets",
    title: "Asset Intake",
    description: "Record assets under the trust (not yet a security).",
    uiComponents: [{ type: "asset-editor", field: "assets", label: "Assets" }],
  },
  {
    id: "certificates",
    title: "Asset Certificates",
    description: "Generate review-grade asset certificates (AC-…) anchored to recorded assets.",
    validationRules: [{ kind: "requiresAuthority", message: "Authority must be confirmed or a draft addendum generated." }],
    uiComponents: [{ type: "certificate-builder", field: "certificates", label: "Certificates" }],
  },
  {
    id: "instruments",
    title: "Instruments",
    description: "Generate promissory notes and security agreements anchored to asset certificates.",
    validationRules: [{ kind: "requiresAuthority", message: "Authority must be confirmed or a draft addendum generated." }],
    uiComponents: [{ type: "instrument-builder", field: "instruments", label: "Promissory Notes & Security Agreements" }],
  },
  {
    id: "package",
    title: "Presentation Package",
    description: "Assemble a review-grade package (Pitch Deck + PPM linkages).",
    uiComponents: [{ type: "package-builder", field: "package", label: "Package Builder" }],
  },
];

// Helper functions for step validation
export function validateStep(stepId: TrustWorkflowStep, data: any): { isValid: boolean; errors: string[] } {
  const stepConfig = TRUST_WORKFLOW_STEPS.find(s => s.id === stepId);
  if (!stepConfig) return { isValid: false, errors: ["Unknown step"] };

  const errors: string[] = [];

  // Check validation rules
  if (stepConfig.validationRules) {
    for (const rule of stepConfig.validationRules) {
      if (rule.kind === "required") {
        const value = getNestedValue(data, rule.field);
        if (!value || (typeof value === "string" && !value.trim())) {
          errors.push(rule.message);
        }
      } else if (rule.kind === "requiresAuthority") {
        // Check if authority is confirmed or draft addendum is requested
        const authorityStatus = getNestedValue(data, "authority.status");
        const generateDraft = getNestedValue(data, "authority.generateDraftAddendum");
        if (authorityStatus !== "confirmed" && !generateDraft) {
          errors.push(rule.message);
        }
      }
    }
  }

  // Check required UI components
  for (const component of stepConfig.uiComponents) {
    if (component.required) {
      const value = getNestedValue(data, component.field);
      if (!value || (typeof value === "string" && !value.trim())) {
        errors.push(`${component.label} is required`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Helper to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Step progression logic
export function getNextStep(currentStep: TrustWorkflowStep): TrustWorkflowStep | null {
  const steps = TRUST_WORKFLOW_STEPS.map(s => s.id);
  const currentIndex = steps.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex === steps.length - 1) return null;
  return steps[currentIndex + 1];
}

export function getPreviousStep(currentStep: TrustWorkflowStep): TrustWorkflowStep | null {
  const steps = TRUST_WORKFLOW_STEPS.map(s => s.id);
  const currentIndex = steps.indexOf(currentStep);
  if (currentIndex <= 0) return null;
  return steps[currentIndex - 1];
}
