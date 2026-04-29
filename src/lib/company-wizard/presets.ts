// Preset System for Parent Company + C-Corp Wizard
// Based on the comprehensive blueprint

import { ParentCorpPreset, ParentCorpModule, ParentCorpDraft } from "./types";

export const PRESET_MODULES: Record<ParentCorpPreset, ParentCorpModule[]> = {
  standard_delaware_c_corp: ["formation", "governance", "equity", "ip", "banking", "compliance"],
  holding_company_with_operating_sub: ["formation", "governance", "equity", "subsidiaries", "ip", "banking", "compliance"],
  bank_ready: ["formation", "governance", "equity", "banking", "compliance"],
  custom: [],
};

export function applyPreset(d: ParentCorpDraft, preset: ParentCorpPreset): ParentCorpDraft {
  const next = { ...d, preset };
  next.selectedModules = preset === "custom" ? next.selectedModules : PRESET_MODULES[preset].slice();

  if (preset === "standard_delaware_c_corp") {
    next.formationState = "DE";
    next.corpType = "c_corp";
    next.companyKind = "operating_company";
  }
  if (preset === "holding_company_with_operating_sub") {
    next.companyKind = "parent_holding_company";
    next.parentStructure = "single_parent_single_sub";
    next.corpType = "c_corp";
  }
  if (preset === "bank_ready") {
    next.registeredAgentPlanned = true;
    next.initialBoardConsentPlanned = true;
    next.officersPlanned = true;
    next.einPlanned = true;
  }
  return next;
}

export function applyStructureChoice(d: ParentCorpDraft, structureChoice: string): ParentCorpDraft {
  const next = { ...d, structureChoice };

  // Pre-configure based on structure choice
  if (structureChoice === "single_c_corp") {
    next.companyKind = "operating_company";
    next.parentStructure = "parent_only";
    next.corpType = "c_corp";
    next.selectedModules = ["formation", "governance", "equity", "banking", "compliance"];
  } else if (structureChoice === "parent_holding_c_corp") {
    next.companyKind = "parent_holding_company";
    next.parentStructure = "single_parent_single_sub";
    next.corpType = "c_corp";
    next.selectedModules = ["formation", "governance", "equity", "subsidiaries", "banking", "compliance"];
  } else if (structureChoice === "parent_multi_subs") {
    next.companyKind = "parent_holding_company";
    next.parentStructure = "single_parent_multi_sub";
    next.corpType = "c_corp";
    next.selectedModules = ["formation", "governance", "equity", "subsidiaries", "ip", "banking", "compliance"];
  } else if (structureChoice === "custom_structure") {
    // Keep existing selections
  }

  return next;
}
