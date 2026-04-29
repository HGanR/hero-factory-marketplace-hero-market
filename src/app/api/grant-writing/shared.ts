/** Shared field definitions and helpers for grant applications */

export const GRANT_TEXT_FIELDS = [
  "legalStatus", "governingDocs", "complianceCerts", "insuranceCoverage",
  "orgContactInfo", "missionStatement", "visionStatement", "geographicAreas",
  "projectSummary", "primaryGoals", "specificFundingNeeds", "needsStatement",
  "supportingEvidence", "currentEfforts", "stakeholders", "alignmentStatement",
  "alignmentSupportingDocs", "staffExpertise", "pastSuccesses", "financialStability",
  "resources", "partnerships", "sustainabilityPlan", "longTermImpact", "replicationScalability",
  "narrative", "budget", "matchingFunds", "fundingSources", "costJustification",
  "evaluationMetrics", "monitoringPlan", "dataCollectionMethods", "reportingSchedule",
  "projectLeader", "financialContact", "authorizedSignatories", "goals", "methodology", "timeline",
  "otherRelevantDocs", "flexibilityModifications", "referralSources",
] as const;

export function buildGrantValues(
  body: Record<string, unknown>,
  overrides: { userId: number; title: string; status: string }
): Record<string, unknown> {
  const v: Record<string, unknown> = {
    userId: overrides.userId,
    title: overrides.title,
    status: overrides.status,
    funderName: body.funderName ? String(body.funderName).trim() || null : null,
    deadline: body.deadline || null,
    amountRequested: body.amountRequested ? String(body.amountRequested).trim() || null : null,
    taxId: body.taxId ? String(body.taxId).trim() || null : null,
    orgLegalName: body.orgLegalName ? String(body.orgLegalName).trim() || null : null,
    orgEntityType: body.orgEntityType ? String(body.orgEntityType).trim() || null : null,
    ethicalAcknowledgment: !!body.ethicalAcknowledgment,
  };
  for (const key of GRANT_TEXT_FIELDS) {
    v[key] = body[key] ? String(body[key]).trim() || null : null;
  }
  return v;
}

export function buildGrantUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.funderName !== undefined) updates.funderName = body.funderName ? String(body.funderName).trim() : null;
  if (body.deadline !== undefined) updates.deadline = body.deadline || null;
  if (body.amountRequested !== undefined) updates.amountRequested = body.amountRequested ? String(body.amountRequested).trim() : null;
  if (["draft", "submitted", "awarded", "declined"].includes(body?.status as string)) updates.status = body.status;
  if (body.taxId !== undefined) updates.taxId = body.taxId ? String(body.taxId).trim() : null;
  if (body.orgLegalName !== undefined) updates.orgLegalName = body.orgLegalName ? String(body.orgLegalName).trim() : null;
  if (body.orgEntityType !== undefined) updates.orgEntityType = body.orgEntityType ? String(body.orgEntityType).trim() : null;
  if (body.ethicalAcknowledgment !== undefined) updates.ethicalAcknowledgment = !!body.ethicalAcknowledgment;
  for (const key of GRANT_TEXT_FIELDS) {
    if (body[key] !== undefined) {
      updates[key] = body[key] ? String(body[key]).trim() : null;
    }
  }
  return updates;
}
