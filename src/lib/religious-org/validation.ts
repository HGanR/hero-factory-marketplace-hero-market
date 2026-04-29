// Enhanced Validation for Religious Organization Wizard
// Based on the comprehensive onboarding blueprint

import { WizardStep, ReligiousOrgDraft, ValidationResult, ValidationIssue, USState } from "./types";
import { getStateRule } from "./state-rules";

function isUSState(v: any): v is USState {
  return typeof v === "string" && v.length === 2;
}
function pctOK(n: number | null): boolean {
  return n === null || (Number.isFinite(n) && n >= 1 && n <= 100);
}

export function validateStep(step: WizardStep, draft: ReligiousOrgDraft): ValidationResult {
  const issues: ValidationIssue[] = [];
  const rule = getStateRule(draft.formationState as USState);

  const require = (field: keyof ReligiousOrgDraft, msg: string) => {
    const v: any = draft[field];
    const empty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim().length === 0);
    if (empty) issues.push({ field: String(field), message: msg, severity: "error" });
  };

  if (step === "setup") {
    require("orgName", "Organization name is required.");
    if (!isUSState(draft.formationState)) issues.push({ field: "formationState", message: "State of formation is required.", severity: "error" });

    // Derive governancePolicyMode suggestion
    // If incorporated, bylaws are expected; if unincorporated, governance policy is expected.
    // We do not hard-force it; we warn.
    if (draft.orgForm === "unincorporated" && draft.governancePolicyMode === "bylaws") {
      issues.push({
        field: "governancePolicyMode",
        message: "Bylaws are generally for incorporated entities. Consider using Governance Policy for unincorporated operation.",
        severity: "warning",
      });
    }
    if (draft.orgForm !== "unincorporated" && draft.governancePolicyMode === "policy") {
      issues.push({
        field: "governancePolicyMode",
        message: "Incorporated entities typically require bylaws. You can proceed, but banks/counterparties often expect bylaws.",
        severity: "warning",
      });
    }
  }

  if (step === "onboarding") {
    if (!draft.selectedModules || draft.selectedModules.length === 0) {
      issues.push({ field: "selectedModules", message: "Select at least one onboarding module.", severity: "error" });
    }
  }

  if (step === "mission") {
    require("statementOfFaith", "Statement of faith / doctrine is required.");
    require("purposeStatement", "Purpose statement is required.");
    require("primaryActivities", "Primary activities are required.");
  }

  if (step === "governance") {
    if (draft.directorsOrTrusteesCount !== null && draft.directorsOrTrusteesCount < 1) {
      issues.push({ field: "directorsOrTrusteesCount", message: "Governing body count must be at least 1.", severity: "error" });
    }
    if (draft.orgForm !== "unincorporated") {
      const min = rule.constraints.minGoverningBodySize ?? null;
      if (min !== null && (draft.directorsOrTrusteesCount ?? 0) < min) {
        issues.push({
          field: "directorsOrTrusteesCount",
          message: `For the selected state guidance, a governing body size of at least ${min} is recommended.`,
          severity: "warning",
        });
      }
    }
  }

  if (step === "state_requirements") {
    if (draft.orgForm !== "unincorporated") {
      if (!draft.registeredAgentPlanned) issues.push({ field: "registeredAgentPlanned", message: "Registered agent planning is recommended.", severity: "warning" });
      if (!draft.initialMeetingPlanned) issues.push({ field: "initialMeetingPlanned", message: "Initial meeting / written consent planning is recommended.", severity: "warning" });
    }
  }

  if (step === "bylaws_or_policy") {
    if (draft.orgForm === "unincorporated") {
      // For unincorporated, policy mode should be used
      if (draft.governancePolicyMode !== "policy") {
        issues.push({ field: "governancePolicyMode", message: "Unincorporated organizations should use Governance Policy mode.", severity: "warning" });
      }
    } else {
      // Incorporated -> bylaws expected
      if (draft.governancePolicyMode !== "bylaws") {
        issues.push({ field: "governancePolicyMode", message: "Incorporated entities typically require bylaws.", severity: "warning" });
      }
      if (!pctOK(draft.quorumPct)) issues.push({ field: "quorumPct", message: "Quorum must be between 1 and 100.", severity: "error" });

      const floor = rule.constraints.quorumFloorPct ?? null;
      if (floor !== null && draft.quorumPct !== null && draft.quorumPct < floor) {
        issues.push({ field: "quorumPct", message: `Quorum appears unusually low (recommended floor: ${floor}%).`, severity: "warning" });
      }
      if (!draft.dissolutionClauseIncluded) issues.push({ field: "dissolutionClauseIncluded", message: "Dissolution clause is strongly recommended.", severity: "warning" });
      if (!draft.conflictPolicyAdopted) issues.push({ field: "conflictPolicyAdopted", message: "Conflict policy adoption is recommended.", severity: "warning" });
    }
  }

  if (step === "ein") {
    if (draft.hasEIN && (draft.einLast4?.trim().length ?? 0) !== 4) {
      issues.push({ field: "einLast4", message: "EIN last 4 digits must be exactly 4 characters.", severity: "error" });
    }
  }

  if (step === "banking") {
    // Not hard requirements, but readiness guidance
    if (!draft.hasEIN) issues.push({ field: "hasEIN", message: "EIN is typically required before opening a bank account.", severity: "warning" });
    if (draft.signatoryRule === "two_signers_over_threshold" && (draft.twoSignerThresholdUSD ?? 0) <= 0) {
      issues.push({ field: "twoSignerThresholdUSD", message: "Set a positive threshold amount for two-signature control.", severity: "error" });
    }
  }

  if (step === "records") {
    require("recordkeepingPlan", "Recordkeeping plan is required (minutes, key docs, donation records).");
  }

  const ok = issues.filter((i) => i.severity === "error").length === 0;
  return { ok, issues };
}
