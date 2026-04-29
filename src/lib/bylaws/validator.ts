// Bylaws Validator Engine
// State-aware validation with legal compliance checking

import { BylawsDraft } from "./wizard-config";
import { BYLAW_RULESETS, validateBylawsAgainstRuleset, BylawRuleset } from "./rulesets";

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationResult = {
  field: string;
  severity: ValidationSeverity;
  message: string;
  statutoryReference?: string;
  suggestedFix?: string;
};

export type ValidationSummary = {
  isValid: boolean;
  canProceed: boolean; // Can proceed with warnings
  results: ValidationResult[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
};

/**
 * Comprehensive bylaws validation against state rules
 */
export function validateBylawsDraft(draft: BylawsDraft): ValidationSummary {
  const results: ValidationResult[] = [];
  const ruleset = BYLAW_RULESETS.find(r => r.id === draft.rulesetId);

  if (!ruleset) {
    results.push({
      field: "rulesetId",
      severity: "error",
      message: "No valid ruleset found for selected state and entity form",
      suggestedFix: "Select a supported state and entity form combination"
    });

    return {
      isValid: false,
      canProceed: false,
      results,
      summary: { errors: 1, warnings: 0, info: 0 }
    };
  }

  // Run ruleset validation
  const rulesetValidation = validateBylawsAgainstRuleset(
    {
      directorCount: draft.directorCount,
      quorumPercentage: draft.quorumPercentage,
      noticeDays: draft.noticeDays,
      clauses: draft.clauses
    },
    ruleset
  );

  // Convert missing required clauses to validation results
  for (const clauseId of rulesetValidation.missingRequired) {
    const clause = ruleset.availableClauses.find(c => c.id === clauseId);
    results.push({
      field: `clauses.${clauseId}`,
      severity: "error",
      message: `${clause?.title || clauseId} is required by ${ruleset.state} law`,
      statutoryReference: clause?.statutoryReference,
      suggestedFix: clause?.defaultContent ? "Use the suggested default content" : "Add this required clause"
    });
  }

  // Convert violations to validation results
  for (const violation of rulesetValidation.violations) {
    results.push({
      field: violation.field,
      severity: "error",
      message: violation.message,
      suggestedFix: "Adjust to meet statutory minimum requirements"
    });
  }

  // Convert warnings to validation results
  for (const warning of rulesetValidation.warnings) {
    results.push({
      field: warning.field,
      severity: "warning",
      message: warning.message,
      suggestedFix: "Consider adding this recommended provision"
    });
  }

  // Additional validation rules
  results.push(...validateClauseContent(draft, ruleset));
  results.push(...validateIrsCompliance(draft, ruleset));
  results.push(...validateProtectorIntegration(draft, ruleset));

  // Calculate summary
  const errors = results.filter(r => r.severity === "error").length;
  const warnings = results.filter(r => r.severity === "warning").length;
  const info = results.filter(r => r.severity === "info").length;

  return {
    isValid: errors === 0,
    canProceed: errors === 0, // For now, require no errors to proceed
    results,
    summary: { errors, warnings, info }
  };
}

/**
 * Validate individual clause content quality
 */
function validateClauseContent(draft: BylawsDraft, ruleset: BylawRuleset): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [clauseId, clauseData] of Object.entries(draft.clauses)) {
    if (!clauseData.enabled || !clauseData.content?.trim()) continue;

    const clause = ruleset.availableClauses.find(c => c.id === clauseId);
    if (!clause) continue;

    const content = clauseData.content.toLowerCase();

    // Check for placeholder text
    if (content.includes("[corporation name]") || content.includes("[charitable purposes]")) {
      results.push({
        field: `clauses.${clauseId}`,
        severity: "warning",
        message: `${clause.title} contains placeholder text that should be customized`,
        suggestedFix: "Replace bracketed placeholders with specific details"
      });
    }

    // Check minimum content length
    if (content.length < 50) {
      results.push({
        field: `clauses.${clauseId}`,
        severity: "info",
        message: `${clause.title} seems brief - consider adding more detail`,
        suggestedFix: "Expand the clause with specific procedures or requirements"
      });
    }

    // State-specific content validation
    if (ruleset.state === "CA" && ruleset.entityForm === "religious_corp") {
      if (clauseId === "religious-purpose" && !content.includes("religious")) {
        results.push({
          field: `clauses.${clauseId}`,
          severity: "warning",
          message: "California religious corporations should clearly state religious purposes",
          statutoryReference: "California Corporations Code § 9112",
          suggestedFix: "Include specific reference to religious purposes and faith tradition"
        });
      }
    }
  }

  return results;
}

/**
 * Validate IRS compliance elements
 */
function validateIrsCompliance(draft: BylawsDraft, ruleset: BylawRuleset): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check if IRS purpose language is included when recommended
  if (draft.governancePackage === "bylaws_foundation" && !draft.includeIrsPurpose) {
    results.push({
      field: "includeIrsPurpose",
      severity: "info",
      message: "Consider including IRS-recommended purpose language for 501(c)(3) compliance",
      suggestedFix: "Enable IRS purpose language inclusion in the wizard"
    });
  }

  // Check dissolution clause for charitable asset protection
  if (draft.governancePackage === "bylaws_foundation" && !draft.includeIrsDissolution) {
    results.push({
      field: "includeIrsDissolution",
      severity: "warning",
      message: "Dissolution clause should protect charitable assets per IRS requirements",
      suggestedFix: "Enable IRS dissolution language inclusion"
    });
  }

  // Check for prohibited activities language
  const dissolutionContent = draft.clauses["dissolution"]?.content?.toLowerCase() || "";
  if (draft.governancePackage === "bylaws_foundation" && !dissolutionContent.includes("501(c)(3)")) {
    results.push({
      field: "clauses.dissolution",
      severity: "warning",
      message: "Dissolution clause should reference 501(c)(3) organizations for IRS compliance",
      suggestedFix: "Include reference to 501(c)(3) organizations in dissolution clause"
    });
  }

  return results;
}

/**
 * Validate Trust Protector integration
 */
function validateProtectorIntegration(draft: BylawsDraft, ruleset: BylawRuleset): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (draft.includeProtector && !ruleset.protectorClauses.allowed) {
    results.push({
      field: "includeProtector",
      severity: "error",
      message: `Trust Protector references are not permitted in ${ruleset.state} ${ruleset.entityForm} bylaws`,
      statutoryReference: ruleset.protectorClauses.statutoryLimits?.[0],
      suggestedFix: "Remove Trust Protector references or use a separate governance agreement"
    });
  }

  if (draft.includeProtector && draft.protectorPowers?.length === 0) {
    results.push({
      field: "protectorPowers",
      severity: "warning",
      message: "Trust Protector included but no powers specified",
      suggestedFix: "Specify which powers the Trust Protector should have"
    });
  }

  // Check for overly broad protector powers
  if (draft.protectorPowers?.includes("director_removal") && !ruleset.protectorClauses.statutoryLimits?.some(limit =>
    limit.toLowerCase().includes("director") || limit.toLowerCase().includes("removal")
  )) {
    results.push({
      field: "protectorPowers",
      severity: "warning",
      message: "Director removal powers may conflict with statutory requirements",
      statutoryReference: ruleset.protectorClauses.statutoryLimits?.find(limit =>
        limit.toLowerCase().includes("director")
      ),
      suggestedFix: "Consult legal counsel about director removal powers in this state"
    });
  }

  return results;
}

/**
 * Generate compliance badge status
 */
export function getComplianceBadge(validation: ValidationSummary): {
  status: "compliant" | "warnings" | "non-compliant";
  label: string;
  color: string;
} {
  if (!validation.isValid) {
    return {
      status: "non-compliant",
      label: "Non-Compliant",
      color: "red"
    };
  }

  if (validation.summary.warnings > 0) {
    return {
      status: "warnings",
      label: "Compliant with Warnings",
      color: "yellow"
    };
  }

  return {
    status: "compliant",
    label: "Fully Compliant",
    color: "green"
  };
}

/**
 * Get actionable fix suggestions
 */
export function getFixSuggestions(validation: ValidationSummary): Array<{
  priority: "high" | "medium" | "low";
  action: string;
  fields: string[];
}> {
  const suggestions: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    fields: string[];
  }> = [];

  const errorFields = validation.results
    .filter(r => r.severity === "error")
    .map(r => r.field);

  const warningFields = validation.results
    .filter(r => r.severity === "warning")
    .map(r => r.field);

  if (errorFields.length > 0) {
    suggestions.push({
      priority: "high",
      action: "Fix statutory compliance issues",
      fields: errorFields
    });
  }

  if (warningFields.length > 0) {
    suggestions.push({
      priority: "medium",
      action: "Address recommended improvements",
      fields: warningFields
    });
  }

  return suggestions;
}








