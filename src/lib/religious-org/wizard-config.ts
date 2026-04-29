// Enhanced Religious Organization Wizard Configuration
// Based on the comprehensive onboarding blueprint

import { WizardStep, ReligiousOrgDraft, StepConfig, UIComponent } from "./types";
import { getStateRule } from "./state-rules";
import { validateStep } from "./validation";
import { PRESET_MODULES } from "./presets";

// Default Religious Organization Draft
export function defaultReligiousOrgDraft(): ReligiousOrgDraft {
  return {
    orgName: "",
    formationState: "",
    orgForm: "unincorporated",
    affiliation: "standalone",

    preset: "standard",
    selectedModules: PRESET_MODULES.standard.slice(),

    statementOfFaith: "",
    purposeStatement: "",
    primaryActivities: "",

    governanceModel: "elders",
    directorsOrTrusteesCount: null,
    officerStructure: "standard_officers",
    officers: [
      { title: "President / Lead Pastor", duties: "Primary executive/spiritual leader; executes governing body decisions." },
      { title: "Secretary", duties: "Maintains records, minutes, attestations, and governance documentation." },
      { title: "Treasurer", duties: "Oversees finances, bank relations, and financial reporting/controls." },
    ],

    registeredAgentPlanned: false,
    initialMeetingPlanned: false,

    governancePolicyMode: "policy",
    memberStructure: "unknown",
    quorumPct: null,
    conflictPolicyAdopted: false,
    dissolutionClauseIncluded: false,

    hasEIN: false,
    einLast4: "",
    signatoryRule: "two_signers_over_threshold",
    twoSignerThresholdUSD: 2500,
    bankingReady: false,

    donationReceipting: true,
    restrictedFunds: true,
    restrictedFundExamples: "Building Fund\nMissions\nBenevolence",

    minutesCadence: "quarterly",
    recordkeepingPlan: "",

    draftVersion: 1,
  };
}

// Bank Readiness Scoring
export type ReadinessScore = {
  score: number; // 0..100
  breakdown: { label: string; points: number; met: boolean }[];
};

export function computeBankReadiness(draft: ReligiousOrgDraft): ReadinessScore {
  const isIncorp = draft.orgForm !== "unincorporated";
  const hasFounding = draft.statementOfFaith.trim() && draft.purposeStatement.trim() && draft.primaryActivities.trim();
  const hasGovernance = (draft.directorsOrTrusteesCount ?? 0) > 0 && (draft.officers?.length ?? 0) >= 2;

  const hasGovDoc = isIncorp
    ? draft.governancePolicyMode === "bylaws" && (draft.quorumPct ?? 0) > 0 && draft.dissolutionClauseIncluded
    : draft.governancePolicyMode === "policy";

  const parts = [
    { label: "Founding content completed", points: 20, met: Boolean(hasFounding) },
    { label: "Governance defined (leaders + officers)", points: 20, met: Boolean(hasGovernance) },
    { label: "EIN obtained", points: 25, met: draft.hasEIN },
    { label: isIncorp ? "Bylaws configured" : "Governance policy selected", points: 20, met: Boolean(hasGovDoc) },
    { label: "Signatory controls set", points: 15, met: draft.signatoryRule === "single_signer" ? true : (draft.twoSignerThresholdUSD ?? 0) > 0 },
  ];

  const score = parts.reduce((s, p) => s + (p.met ? p.points : 0), 0);
  return { score, breakdown: parts };
}

// Wizard Steps Configuration
function hasModule(d: ReligiousOrgDraft, m: import("./types").ReligiousOrgModule): boolean {
  return (d.selectedModules ?? []).includes(m);
}

function stateGuidanceCallout(draft: ReligiousOrgDraft): UIComponent {
  const rule = getStateRule(draft.formationState as any);
  return {
    type: "callout",
    tone: "info",
    title: `State guidance: ${draft.formationState || "Select a state"}`,
    body: rule.overview.join(" "),
  };
}

export function buildReligiousOrgWizardSteps(draft: ReligiousOrgDraft): StepConfig[] {
  const rule = getStateRule(draft.formationState as any);
  const readiness = computeBankReadiness(draft);
  const readinessBody =
    `Current score: ${readiness.score}/100. ` +
    readiness.breakdown.map((b) => `${b.met ? "✓" : "•"} ${b.label} (${b.points})`).join("  ");

  return [
    {
      id: "setup",
      title: "Setup",
      description: "Define the organization, formation state, and structure.",
      uiComponents: [
        {
          type: "callout",
          tone: "warning",
          title: "Draft / Review posture",
          body: "This wizard generates Draft/Review governance outputs for internal adoption. It does not file documents with any government agency and is not legal advice.",
        },
        { type: "input", field: "orgName", label: "Organization Name", required: true, placeholder: "Example: Kingdom Outreach Church" },
        {
          type: "select",
          field: "formationState",
          label: "State of Formation",
          required: true,
          helpText: "Used to display state-aware governance guidance and defaults.",
          options: [
            { value: "TX", label: "Texas (TX)" },
            { value: "DE", label: "Delaware (DE)" },
            { value: "CA", label: "California (CA)" },
            { value: "NY", label: "New York (NY)" },
            { value: "FL", label: "Florida (FL)" },
          ],
        },
        stateGuidanceCallout(draft),
        {
          type: "select",
          field: "orgForm",
          label: "Entity Form",
          required: true,
          badge: rule.fieldHelp.orgForm,
          options: [
            { value: "unincorporated", label: "Unincorporated Religious Organization", helpText: "Simpler setup; may increase banking/contracting friction." },
            { value: "nonprofit_corporation", label: "Nonprofit Corporation", helpText: "Common for banking, contracts, and liability containment." },
            { value: "religious_corporation", label: "Religious Corporation", helpText: "Religious-specific corporate form where applicable." },
          ],
        },
        {
          type: "select",
          field: "affiliation",
          label: "Affiliation / Intended Use",
          required: true,
          options: [
            { value: "standalone", label: "Standalone religious organization" },
            { value: "affiliated_to_trust", label: "Affiliated to a Trust" },
            { value: "affiliated_to_family_office", label: "Affiliated to a Family Office" },
            { value: "affiliated_to_foundation", label: "Affiliated to a Foundation" },
            { value: "dao_wrapper_support", label: "DAO wrapper support (off-chain contracting/operations)" },
          ],
          helpText: "This controls which optional onboarding modules appear; it does not change legal posture automatically.",
        },
        {
          type: "select",
          field: "governancePolicyMode",
          label: "Governance Document Mode",
          required: true,
          options: [
            { value: "policy", label: "Governance Policy (unincorporated)", helpText: "Internal governance policy appropriate for unincorporated operation." },
            { value: "bylaws", label: "Bylaws (incorporated)", helpText: "Corporate bylaws appropriate for incorporated entities." },
          ],
          helpText: "Select the governance document type you intend to adopt.",
        },
      ],
      validate: (d) => validateStep("setup", d),
    },

    {
      id: "onboarding",
      title: "Onboarding Options",
      description: "Choose what you want to set up now. The wizard will only show selected modules.",
      uiComponents: [
        {
          type: "select",
          field: "preset",
          label: "Preset",
          required: true,
          helpText: "Presets pre-select modules. You can customize afterward.",
          options: [
            { value: "standard", label: "Standard church/ministry (recommended)" },
            { value: "bank_ready", label: "Banking-ready entity (recommended if opening accounts)" },
            { value: "trust_affiliated", label: "Trust-affiliated ministry" },
            { value: "dao_ready", label: "DAO wrapper readiness (advanced)" },
            { value: "custom", label: "Custom (pick modules manually)" },
          ],
        },
        {
          type: "multi-checkbox",
          field: "selectedModules",
          label: "Select modules",
          required: true,
          helpText: "Only selected modules will appear as steps.",
          options: [
            { value: "founding_docs", label: "Founding documents (Statement of Faith + Purpose)", helpText: "Core mission and doctrinal foundation." },
            { value: "governance", label: "Governance structure", helpText: "Leaders, officers, governing body size." },
            { value: "state_readiness", label: "State formation readiness", helpText: "Registered agent + initial meeting planning (if incorporating)." },
            { value: "bylaws_or_policy", label: "Bylaws / Governance Policy", helpText: "Corporate bylaws (incorp) or governance policy (unincorp)." },
            { value: "ein", label: "EIN readiness", helpText: "Track EIN status for banking and operations." },
            { value: "banking_pack", label: "Banking readiness pack", helpText: "Signatories, authority, and banking resolution readiness." },
            { value: "donations", label: "Donations & receipting", helpText: "Restricted funds, receipting practices." },
            { value: "records", label: "Records & minutes policy", helpText: "Minutes cadence + retention discipline." },
            { value: "affiliations", label: "Affiliation linking", helpText: "Link to Trust / Family Office / Foundation / DAO wrapper context." },
          ],
        },
        { type: "callout", tone: "info", title: "Bank readiness indicator", body: readinessBody },
      ],
      validate: (d) => validateStep("onboarding", d),
    },

    {
      id: "mission",
      title: "Mission and Doctrine",
      description: "Define statement of faith, purpose, and primary activities.",
      when: (d) => hasModule(d, "founding_docs"),
      uiComponents: [
        { type: "textarea", field: "statementOfFaith", label: "Statement of Faith / Doctrine", required: true, rows: 6 },
        { type: "textarea", field: "purposeStatement", label: "Purpose Statement", required: true, rows: 5 },
        { type: "textarea", field: "primaryActivities", label: "Primary Activities", required: true, rows: 5 },
      ],
      validate: (d) => validateStep("mission", d),
    },

    {
      id: "governance",
      title: "Governance",
      description: "Define governing model, leadership, officers, and decision structure.",
      when: (d) => hasModule(d, "governance"),
      uiComponents: [
        {
          type: "select",
          field: "governanceModel",
          label: "Governance Model",
          required: true,
          options: [
            { value: "elders", label: "Elders" },
            { value: "board_of_directors", label: "Board of Directors" },
            { value: "trustees", label: "Trustees" },
            { value: "hybrid", label: "Hybrid" },
          ],
        },
        {
          type: "input",
          field: "directorsOrTrusteesCount",
          label: "Governing body size (count)",
          inputType: "number",
          placeholder: "3",
          badge: rule.fieldHelp.directorsOrTrusteesCount,
        },
        {
          type: "select",
          field: "officerStructure",
          label: "Officer Structure",
          required: true,
          options: [
            { value: "standard_officers", label: "Standard officers (recommended)" },
            { value: "custom", label: "Custom" },
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Oversight roles",
          body: "If affiliated to a Trust or other entity, oversight roles should be structural safeguards (not day-to-day control).",
        },
      ],
      validate: (d) => validateStep("governance", d),
    },

    {
      id: "state_requirements",
      title: "State Formation Readiness",
      description: "Plan formation and governance formalities where applicable.",
      when: (d) => hasModule(d, "state_readiness"),
      uiComponents: [
        stateGuidanceCallout(draft),
        {
          type: "checkbox",
          field: "registeredAgentPlanned",
          label: "Registered agent identified (if incorporating)",
          helpText: "Recommended for incorporation readiness.",
        },
        {
          type: "checkbox",
          field: "initialMeetingPlanned",
          label: "Initial meeting / written consent planned",
          helpText: "Recommended for governance legitimacy and documentation.",
        },
      ],
      validate: (d) => validateStep("state_requirements", d),
    },

    {
      id: "bylaws_or_policy",
      title: "Bylaws / Governance Policy",
      description: "Configure bylaws (incorporated) or governance policy (unincorporated).",
      when: (d) => hasModule(d, "bylaws_or_policy"),
      uiComponents: [
        {
          type: "callout",
          tone: "info",
          title: draft.orgForm === "unincorporated" ? "Governance Policy mode" : "Bylaws mode",
          body:
            draft.orgForm === "unincorporated"
              ? "Unincorporated organizations typically adopt an internal governance policy rather than corporate bylaws."
              : "Incorporated entities typically adopt bylaws to define governance authority and meeting procedures.",
        },
        {
          type: "select",
          field: "memberStructure",
          label: "Member structure",
          required: false,
          badge: rule.bylawsHelp.memberStructure,
          options: [
            { value: "unknown", label: "Not sure yet" },
            { value: "non_member", label: "Non-member (board governed)" },
            { value: "member", label: "Member corporation" },
          ],
        },
        {
          type: "input",
          field: "quorumPct",
          label: "Quorum percentage",
          inputType: "number",
          placeholder: "33",
          badge: rule.bylawsHelp.quorum,
          helpText: rule.bylawsHelp.quorum.detail,
        },
        {
          type: "checkbox",
          field: "conflictPolicyAdopted",
          label: "Adopt conflict of interest policy",
          badge: rule.bylawsHelp.conflictPolicy,
        },
        {
          type: "checkbox",
          field: "dissolutionClauseIncluded",
          label: "Include dissolution clause (asset disposition)",
          badge: rule.bylawsHelp.dissolution,
        },
      ],
      validate: (d) => validateStep("bylaws_or_policy", d),
    },

    {
      id: "ein",
      title: "EIN Readiness",
      description: "Track EIN status for banking and operational readiness.",
      when: (d) => hasModule(d, "ein"),
      uiComponents: [
        { type: "checkbox", field: "hasEIN", label: "EIN obtained" },
        { type: "input", field: "einLast4", label: "EIN last 4 digits (optional)", placeholder: "1234" },
      ],
      validate: (d) => validateStep("ein", d),
    },

    {
      id: "banking",
      title: "Banking Readiness Pack",
      description: "Define signatories and authority controls; generate banking-ready artifacts.",
      when: (d) => hasModule(d, "banking_pack"),
      uiComponents: [
        { type: "callout", tone: "info", title: "Bank readiness indicator", body: readinessBody },
        {
          type: "select",
          field: "signatoryRule",
          label: "Signatory control",
          required: true,
          options: [
            { value: "single_signer", label: "Single signer allowed" },
            { value: "two_signers_over_threshold", label: "Two signers required over threshold" },
          ],
        },
        {
          type: "input",
          field: "twoSignerThresholdUSD",
          label: "Two-signer threshold (USD)",
          inputType: "number",
          placeholder: "2500",
          helpText: "Applies only if two-signer rule is selected.",
        },
        { type: "checkbox", field: "bankingReady", label: "Mark as banking-ready" },
        {
          type: "callout",
          tone: "warning",
          title: "Typical bank requests",
          body: "EIN confirmation, governance documents, officer authority, and minutes/resolutions authorizing account opening.",
        },
      ],
      validate: (d) => validateStep("banking", d),
    },

    {
      id: "donations",
      title: "Donations & Receipting",
      description: "Configure donation tracking and restricted funds practices.",
      when: (d) => hasModule(d, "donations"),
      uiComponents: [
        { type: "checkbox", field: "donationReceipting", label: "Maintain donation receipts" },
        { type: "checkbox", field: "restrictedFunds", label: "Support restricted funds (recommended)" },
        {
          type: "textarea",
          field: "restrictedFundExamples",
          label: "Restricted fund examples",
          rows: 4,
          placeholder: "Building Fund\nMissions\nBenevolence",
          helpText: "Used to generate a simple restricted-gift tracking policy.",
        },
      ],
      validate: (d) => validateStep("donations", d),
    },

    {
      id: "records",
      title: "Records & Minutes Policy",
      description: "Set minutes cadence and recordkeeping discipline.",
      when: (d) => hasModule(d, "records"),
      uiComponents: [
        {
          type: "select",
          field: "minutesCadence",
          label: "Minutes cadence",
          required: true,
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "annually", label: "Annually" },
            { value: "as_needed", label: "As needed" },
          ],
        },
        {
          type: "textarea",
          field: "recordkeepingPlan",
          label: "Recordkeeping plan",
          required: true,
          rows: 6,
          placeholder: "Describe how you will maintain founding docs, minutes, donation records, financial controls, and leadership rosters.",
          badge: rule.fieldHelp.recordkeepingPlan,
        },
      ],
      validate: (d) => validateStep("records", d),
    },

    {
      id: "review",
      title: "Review & Generate",
      description: "Confirm selections and generate Draft/Review outputs for adoption and records.",
      uiComponents: [
        {
          type: "callout",
          tone: "info",
          title: "Planned outputs",
          body: "Draft/Review documents may include: founding declaration, bylaws or governance policy, adoption resolution, initial minutes template, officer appointment resolution, and banking resolution.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Counsel review recommended",
          body: "State laws vary. Review with qualified counsel prior to adoption and external use.",
        },
      ],
      validate: (d) => validateStep("review", d),
    },
  ];
}

// Step Navigation Helpers
export function getVisibleSteps(draft: ReligiousOrgDraft): WizardStep[] {
  return buildReligiousOrgWizardSteps(draft)
    .filter((s) => (s.when ? s.when(draft) : true))
    .map((s) => s.id);
}

export function getNextStep(current: WizardStep, draft: ReligiousOrgDraft): WizardStep | null {
  const steps = getVisibleSteps(draft);
  const idx = steps.indexOf(current);
  if (idx < 0) return steps[0] ?? null;
  return steps[idx + 1] ?? null;
}

export function getPreviousStep(current: WizardStep, draft: ReligiousOrgDraft): WizardStep | null {
  const steps = getVisibleSteps(draft);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1] ?? null;
}

// Field Help Utility
export function getFieldHelp(state: string, field: keyof ReligiousOrgDraft) {
  const rule = getStateRule(state as any);
  return rule.fieldHelp[field];
}