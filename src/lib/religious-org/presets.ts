// Preset System for Religious Organization Wizard
// Based on the comprehensive onboarding blueprint

import { ReligiousOrgPreset, ReligiousOrgModule, ReligiousOrgDraft } from "./types";

export const PRESET_MODULES: Record<ReligiousOrgPreset, ReligiousOrgModule[]> = {
  standard: ["founding_docs", "governance", "ein", "donations", "records"],
  bank_ready: ["founding_docs", "governance", "state_readiness", "bylaws_or_policy", "ein", "banking_pack", "records", "donations"],
  trust_affiliated: ["founding_docs", "governance", "ein", "banking_pack", "records", "donations", "affiliations"],
  dao_ready: ["founding_docs", "governance", "state_readiness", "bylaws_or_policy", "ein", "banking_pack", "records", "affiliations"],
  custom: [],
};

export function applyPreset(draft: ReligiousOrgDraft, preset: ReligiousOrgPreset): ReligiousOrgDraft {
  const next: ReligiousOrgDraft = { ...draft, preset };
  next.selectedModules = preset === "custom" ? next.selectedModules : PRESET_MODULES[preset].slice();

  // Small, safe nudges:
  if (preset === "bank_ready") {
    next.orgForm = next.orgForm === "unincorporated" ? "nonprofit_corporation" : next.orgForm;
    next.governancePolicyMode = "bylaws";
  }
  if (preset === "trust_affiliated") {
    next.affiliation = next.affiliation === "standalone" ? "affiliated_to_trust" : next.affiliation;
  }
  if (preset === "dao_ready") {
    next.affiliation = "dao_wrapper_support";
    next.orgForm = next.orgForm === "unincorporated" ? "nonprofit_corporation" : next.orgForm;
    next.governancePolicyMode = "bylaws";
  }
  return next;
}








