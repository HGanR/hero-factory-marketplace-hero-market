// Parent Company + C-Corp Wizard Configuration
// Based on the comprehensive blueprint

import { WizardStep, ParentCorpDraft, StepConfig, UIComponent } from "./types";
import { getStateRule } from "./state-rules";
import { validateStep } from "./validation";
import { PRESET_MODULES } from "./presets";

export function defaultParentCorpDraft(): ParentCorpDraft {
  return {
    companyName: "",
    formationState: "DE",
    companyKind: "operating_company",
    corpType: "c_corp",
    parentStructure: "unknown",

    structureChoice: "single_c_corp", // Add structure choice
    preset: "standard_delaware_c_corp",
    selectedModules: PRESET_MODULES.standard_delaware_c_corp.slice(),

    registeredAgentPlanned: false,
    authorizedShares: 10000000,
    parValue: 0.00001,
    fiscalYearEndMonth: 12,

    boardSize: 1,
    officersPlanned: true,
    initialBoardConsentPlanned: true,

    founders: [{ name: "", role: "Founder/CEO", equityPct: 100 }],
    founderIssuancePlanned: true,
    optionPoolPlanned: false,
    optionPoolPct: 10,
    vestingStandard: true,

    subsidiaries: [],
    parentOwns100Pct: true,

    ipAssignmentPlanned: true,
    inventionsAssignmentPlanned: true,

    einPlanned: true,
    bankingReady: false,
    signatoryRule: "two_signers_over_threshold",
    twoSignerThresholdUSD: 5000,

    annualReportPlanned: true,
    franchiseTaxAwareness: true,

    draftVersion: 1,
  };
}

function hasModule(d: ParentCorpDraft, m: import("./types").ParentCorpModule): boolean {
  return (d.selectedModules ?? []).includes(m);
}

function stateCallout(d: ParentCorpDraft): UIComponent {
  const r = getStateRule(d.formationState as any);
  return { type: "callout", tone: "info", title: `State guidance: ${d.formationState || "Select a state"}`, body: r.overview.join(" ") };
}

export function buildParentCorpWizardSteps(d: ParentCorpDraft): StepConfig[] {
  const stateRule = getStateRule(d.formationState as any);

  return [
    {
      id: "structure_builder",
      title: "Structure Builder",
      description: "Choose your corporate structure - this will pre-configure the wizard for optimal setup.",
      uiComponents: [
        { type: "callout", tone: "info", title: "Structure Builder", body: "Select your desired corporate structure and we'll automatically configure the appropriate modules and settings for your setup." },
        { type: "select", field: "structureChoice", label: "Corporate Structure", required: true, options: [
          { value: "single_c_corp", label: "Single C-Corporation", helpText: "Standard operating company with banking-ready setup" },
          { value: "parent_holding_c_corp", label: "Parent Holding + Operating Sub", helpText: "Holding company structure for asset protection and subsidiaries" },
          { value: "parent_multi_subs", label: "Parent + Multiple Subsidiaries", helpText: "Complex structure with IP, real estate, and operating subsidiaries" },
          { value: "custom_structure", label: "Custom Structure", helpText: "Build your own configuration" },
        ]},
      ],
      validate: (x) => validateStep("structure_builder", x),
    },

    {
      id: "setup",
      title: "Setup",
      description: "Define what you are forming and the intended structure.",
      uiComponents: [
        { type: "callout", tone: "warning", title: "Draft / Review posture", body: "This wizard generates Draft/Review corporate artifacts for internal adoption. It does not file documents with the state or IRS and is not legal advice." },
        { type: "input", field: "companyName", label: "Company name", required: true, placeholder: "Example: Apex Holdings Inc." },
        { type: "select", field: "formationState", label: "State of formation", required: true, options: [
          { value: "DE", label: "Delaware (DE)" },
          { value: "WY", label: "Wyoming (WY)" },
          { value: "TX", label: "Texas (TX)" },
          { value: "CA", label: "California (CA)" },
          { value: "NY", label: "New York (NY)" },
        ]},
        stateCallout(d),
        { type: "select", field: "companyKind", label: "Company role", required: true, options: [
          { value: "parent_holding_company", label: "Parent / Holding company" },
          { value: "operating_company", label: "Operating company" },
        ]},
        { type: "select", field: "corpType", label: "Entity type", required: true, options: [
          { value: "c_corp", label: "C-Corporation (C-Corp)" },
          { value: "llc", label: "LLC (not primary in this wizard)" },
          { value: "s_corp", label: "S-Corp (not primary in this wizard)" },
          { value: "unknown", label: "Not sure yet" },
        ]},
        { type: "select", field: "parentStructure", label: "Parent structure", required: false, options: [
          { value: "unknown", label: "Not sure yet" },
          { value: "parent_only", label: "Parent only (no subsidiaries planned)" },
          { value: "single_parent_single_sub", label: "Parent + one operating subsidiary" },
          { value: "single_parent_multi_sub", label: "Parent + multiple subsidiaries" },
        ]},
      ],
      validate: (x) => validateStep("setup", x),
    },

    {
      id: "onboarding",
      title: "Onboarding Options",
      description: "Choose what you want to set up now; only selected modules will appear.",
      uiComponents: [
        { type: "select", field: "preset", label: "Preset", required: true, options: [
          { value: "standard_delaware_c_corp", label: "Standard Delaware C-Corp" },
          { value: "holding_company_with_operating_sub", label: "Holding company + operating subsidiary" },
          { value: "bank_ready", label: "Bank-ready pack" },
          { value: "custom", label: "Custom" },
        ], helpText: "Presets preselect modules; you can customize afterward." },
        { type: "multi-checkbox", field: "selectedModules", label: "Modules", required: true, options: [
          { value: "formation", label: "Formation inputs", helpText: "Authorized shares, par value, fiscal year, registered agent planning." },
          { value: "governance", label: "Governance", helpText: "Board/officers + initial consents." },
          { value: "equity", label: "Equity & cap table", helpText: "Founder issuance, option pool planning, vesting defaults." },
          { value: "subsidiaries", label: "Subsidiaries", helpText: "Plan operating/IP/real estate subsidiaries and ownership." },
          { value: "ip", label: "IP assignments", helpText: "Founder IP assignment + inventions assignment planning." },
          { value: "banking", label: "Banking readiness", helpText: "Signatory controls + bank resolution readiness." },
          { value: "compliance", label: "Compliance readiness", helpText: "Annual reports, franchise tax awareness." },
        ]},
      ],
      validate: (x) => validateStep("onboarding", x),
    },

    {
      id: "formation",
      title: "Formation Inputs",
      description: "Configure baseline formation details (Draft/Review).",
      when: (x) => hasModule(x, "formation"),
      uiComponents: [
        stateCallout(d),
        { type: "checkbox", field: "registeredAgentPlanned", label: "Registered agent planned", helpText: "Required to file in most states." },
        { type: "input", field: "authorizedShares", label: "Authorized shares", inputType: "number", required: true, badge: stateRule.fieldHelp.authorizedShares },
        { type: "input", field: "parValue", label: "Par value", inputType: "number", required: true, badge: stateRule.fieldHelp.parValue },
        { type: "input", field: "fiscalYearEndMonth", label: "Fiscal year end month (1–12)", inputType: "number", required: true },
      ],
      validate: (x) => validateStep("formation", x),
    },

    {
      id: "governance",
      title: "Governance",
      description: "Board structure, officers, and initial actions.",
      when: (x) => hasModule(x, "governance"),
      uiComponents: [
        { type: "input", field: "boardSize", label: "Initial board size", inputType: "number", required: true },
        { type: "checkbox", field: "officersPlanned", label: "Officer roles planned (CEO/President, Secretary, Treasurer/CFO)" },
        { type: "checkbox", field: "initialBoardConsentPlanned", label: "Initial board consent / organizational minutes planned" },
      ],
      validate: (x) => validateStep("governance", x),
    },

    {
      id: "equity",
      title: "Equity & Cap Table",
      description: "Founder issuance planning and equity program basics.",
      when: (x) => hasModule(x, "equity"),
      uiComponents: [
        { type: "checkbox", field: "founderIssuancePlanned", label: "Founder stock issuance planned (Draft/Review)" },
        { type: "checkbox", field: "optionPoolPlanned", label: "Option pool planned" },
        { type: "input", field: "optionPoolPct", label: "Option pool % (if planned)", inputType: "number" },
        { type: "checkbox", field: "vestingStandard", label: "Use standard vesting (e.g., 4 years with 1-year cliff)" },
        { type: "callout", tone: "info", title: "Note", body: "Equity issuances should be reviewed for securities compliance and tax implications." },
      ],
      validate: (x) => validateStep("equity", x),
    },

    {
      id: "subsidiaries",
      title: "Subsidiaries",
      description: "Plan your parent/sub structure and ownership.",
      when: (x) => hasModule(x, "subsidiaries"),
      uiComponents: [
        { type: "checkbox", field: "parentOwns100Pct", label: "Parent owns 100% of subsidiary equity (default)" },
        { type: "callout", tone: "info", title: "Structure guidance", body: "A parent/sub structure can separate operating risk, IP ownership, or real estate holdings. Ensure governance and intercompany agreements are handled appropriately." },
      ],
      validate: (x) => validateStep("subsidiaries", x),
    },

    {
      id: "ip",
      title: "IP & Inventions",
      description: "Plan IP assignment documentation for clean ownership.",
      when: (x) => hasModule(x, "ip"),
      uiComponents: [
        { type: "checkbox", field: "ipAssignmentPlanned", label: "Founder IP assignment planned" },
        { type: "checkbox", field: "inventionsAssignmentPlanned", label: "Inventions assignment policy planned (employees/contractors)" },
      ],
      validate: (x) => validateStep("ip", x),
    },

    {
      id: "banking",
      title: "Banking Readiness",
      description: "Signatory controls and bank-resolution readiness.",
      when: (x) => hasModule(x, "banking"),
      uiComponents: [
        { type: "checkbox", field: "einPlanned", label: "EIN planned/obtained", helpText: "EIN is typically required before opening bank accounts." },
        { type: "select", field: "signatoryRule", label: "Signatory control", required: true, options: [
          { value: "single_signer", label: "Single signer allowed" },
          { value: "two_signers_over_threshold", label: "Two signers required over threshold" },
        ]},
        { type: "input", field: "twoSignerThresholdUSD", label: "Two-signer threshold (USD)", inputType: "number", placeholder: "5000" },
        { type: "checkbox", field: "bankingReady", label: "Mark as banking-ready (after governance docs + resolutions)" },
      ],
      validate: (x) => validateStep("banking", x),
    },

    {
      id: "compliance",
      title: "Compliance Readiness",
      description: "High-level operational compliance planning.",
      when: (x) => hasModule(x, "compliance"),
      uiComponents: [
        { type: "checkbox", field: "annualReportPlanned", label: "Annual report filings planned" },
        { type: "checkbox", field: "franchiseTaxAwareness", label: "Franchise tax / annual fee awareness acknowledged", badge: stateRule.fieldHelp.franchiseTaxAwareness },
      ],
      validate: (x) => validateStep("compliance", x),
    },

    {
      id: "review",
      title: "Review & Generate",
      description: "Generate Draft/Review corporate artifacts for counsel review and internal adoption.",
      uiComponents: [
        { type: "callout", tone: "info", title: "Planned outputs", body: "Draft/Review artifacts may include: Certificate of Incorporation data, bylaws, initial consents/minutes, officer appointments, bank resolution, and equity issuance templates." },
        { type: "callout", tone: "warning", title: "Counsel review recommended", body: "State law, securities compliance, and tax rules vary. Review before adoption and external use." },
      ],
      validate: (x) => validateStep("review", x),
    },
  ];
}

// Step Navigation Helpers
export function getVisibleSteps(d: ParentCorpDraft): WizardStep[] {
  return buildParentCorpWizardSteps(d)
    .filter(s => (s.when ? s.when(d) : true))
    .map(s => s.id);
}

export function getNextStep(current: WizardStep, d: ParentCorpDraft): WizardStep | null {
  const steps = getVisibleSteps(d);
  const idx = steps.indexOf(current);
  if (idx < 0) return steps[0] ?? null;
  return steps[idx + 1] ?? null;
}

export function getPreviousStep(current: WizardStep, d: ParentCorpDraft): WizardStep | null {
  const steps = getVisibleSteps(d);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1] ?? null;
}
