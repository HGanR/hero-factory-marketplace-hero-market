import crypto from "crypto";

import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";

function newPartyId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Deep-merge Jarva intake into an existing Smart Trust draft object (loosely typed).
 * Preserves unrelated keys. Adds/updates parties for Grantor/Settlor and Trustee when intake provides data.
 */
export function mergeIntakeIntoSmartTrustDraft(existingDraft: Record<string, unknown> | null, intake: JarvaTrustIntake): Record<string, unknown> {
  const next: Record<string, unknown> = existingDraft ? { ...existingDraft } : {};
  if (!existingDraft?.draftId && typeof next.draftId !== "string") {
    next.draftId = newPartyId();
  }
  if (typeof next.stateVersion !== "number") next.stateVersion = 0;

  if (intake.trustName && String(intake.trustName).trim()) {
    next.trustName = intake.trustName.trim();
  }
  if (intake.objectives && String(intake.objectives).trim()) {
    next.objectives = intake.objectives.trim();
  }
  if (intake.governingState && String(intake.governingState).trim()) {
    const st = intake.governingState.trim().toUpperCase();
    next.governingState = st;
    next.jurisdiction = st;
  }
  if (typeof intake.pourOverWillNeeded === "boolean") {
    next.pourOverWillNeeded = intake.pourOverWillNeeded;
  }
  if (intake.matterLabel && String(intake.matterLabel).trim()) {
    next.matterName = intake.matterLabel.trim();
  }

  if (intake.firm?.name || intake.firm?.address || intake.firm?.phone || intake.firm?.email) {
    if (intake.firm.name) next.firmName = intake.firm.name.trim();
    if (intake.firm.address) next.firmAddress = intake.firm.address.trim();
    if (intake.firm.phone) next.firmPhone = intake.firm.phone.trim();
    if (intake.firm.email) next.firmEmail = intake.firm.email.trim();
  }

  const parties = Array.isArray(next.parties) ? [...(next.parties as unknown[])] : [];

  const upsertRole = (
    role: "Grantor/Settlor" | "Trustee",
    src: NonNullable<JarvaTrustIntake["grantor"]> | NonNullable<JarvaTrustIntake["trustee"]> | undefined
  ) => {
    if (!src || !Object.values(src).some((v) => v !== undefined && v !== null && String(v).trim() !== "")) return;
    const idx = parties.findIndex((p: any) => p?.role === role);
    const base =
      idx >= 0
        ? { ...(parties[idx] as object) }
        : {
            id: newPartyId(),
            role,
            name: "",
          };
    const row: Record<string, unknown> = { ...base, role };
    if (src.name) row.name = src.name.trim();
    if (src.email) row.email = String(src.email).trim();
    if (src.phone) row.phone = src.phone.trim();
    if (src.addressLine1) row.addressLine1 = src.addressLine1.trim();
    if (src.addressLine2) row.addressLine2 = src.addressLine2.trim();
    if (src.city) row.city = src.city.trim();
    if (src.state) row.state = src.state.trim();
    if (src.postalCode) row.postalCode = src.postalCode.trim();
    if (src.country) row.country = src.country.trim();

    if (idx >= 0) parties[idx] = row;
    else parties.push(row);
  };

  upsertRole("Grantor/Settlor", intake.grantor);
  upsertRole("Trustee", intake.trustee);

  if (intake.successorTrusteeNote && String(intake.successorTrusteeNote).trim()) {
    const note = intake.successorTrusteeNote.trim();
    const idx = parties.findIndex((p: any) => p?.role === "Successor Trustee");
    const row: Record<string, unknown> =
      idx >= 0
        ? { ...(parties[idx] as object), role: "Successor Trustee" as const, name: note }
        : { id: newPartyId(), role: "Successor Trustee", name: note };
    if (idx >= 0) parties[idx] = row;
    else parties.push(row);
  }

  if (intake.beneficiariesSummary && String(intake.beneficiariesSummary).trim()) {
    const summary = intake.beneficiariesSummary.trim();
    const idx = parties.findIndex((p: any) => p?.role === "Beneficiary");
    const row: Record<string, unknown> =
      idx >= 0
        ? { ...(parties[idx] as object), role: "Beneficiary" as const, name: summary }
        : { id: newPartyId(), role: "Beneficiary", name: summary };
    if (idx >= 0) parties[idx] = row;
    else parties.push(row);
  }

  next.parties = parties;

  next.jarvaIntakeAppliedAt = new Date().toISOString();

  return next;
}
