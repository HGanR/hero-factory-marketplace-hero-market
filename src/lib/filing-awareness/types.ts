// src/lib/filing-awareness/types.ts

export type FilingAudience = "consultant" | "client" | "both";

export type FilingCategory =
  | "authority"
  | "fiduciary_notice"
  | "address_responsible_party"
  | "tax_return"
  | "information_return"
  | "banking_kyc"
  | "state_registration"
  | "other";

export type TimelineBucket =
  | "immediate_after_event"
  | "before_transacting"
  | "within_first_tax_year"
  | "annual_or_recurring"
  | "event_driven_only"
  | "as_needed";

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * This is NOT a determination of requirement.
 * It's a heuristic indicator for surfacing awareness items.
 */
export type Relevance = {
  score: number; // 0-100
  confidence: ConfidenceLevel;
  reasons: string[]; // human-readable triggers
};

export type EntityContext =
  | "revocable_living_trust"
  | "irrevocable_trust"
  | "charitable_foundation"
  | "religious_organization"
  | "family_office"
  | "company_c_corp"
  | "company_parent_holding"
  | "dao_wrapper"
  | "other";

export type FilingEvent =
  | "fiduciary_appointed"
  | "fiduciary_changed"
  | "fiduciary_terminated"
  | "authorized_representative_added"
  | "authorized_representative_removed"
  | "ein_obtained"
  | "address_changed"
  | "responsible_party_changed"
  | "bank_account_opening"
  | "tax_year_end"
  | "income_generated"
  | "distributions_made"
  | "offering_or_capital_raise"
  | "foreign_entity_or_nonresident_factor"
  | "charitable_solicitation"
  | "employee_or_contractor_onboarding";

export type FilingInstrumentId =
  | "irs_2848"
  | "irs_56"
  | "irs_56f"
  | "irs_8822b"
  | "irs_1041"
  // Optional extensions you may want to include early:
  | "irs_ss4_ein"
  | "irs_990_series"
  | "irs_1120"
  | "irs_w9"
  | "state_charity_registration"
  | "bank_resolution_packet";

export type InstrumentCard = {
  id: FilingInstrumentId;
  displayName: string;
  category: FilingCategory;
  audience: FilingAudience;

  // High-level "what it is" copy; informational only.
  summary: string;

  // Guardrailed fields that avoid "must/required" language:
  commonTriggers: string[];
  typicalTimeframe: TimelineBucket;
  whoTypicallyHandles: string[]; // e.g., ["CPA", "Attorney", "Authorized Fiduciary"]

  consultantTalkingPoints: string[];
  platformBoundaryNote: string;

  // Optional references (do not claim deadlines; keep neutral)
  references?: { label: string; note: string }[];
};

export type FilingAwarenessInput = {
  entityContext: EntityContext;

  // Data the platform already has / can infer:
  hasEIN?: boolean;
  formationState?: string | null;
  governingLawState?: string | null;

  isGrantorTrust?: boolean | null;
  isIrrevocable?: boolean | null;
  isCharitable?: boolean | null;
  isReligiousOrg508c1a?: boolean | null;

  hasBankingIntent?: boolean; // user indicates "we will open a bank account"
  hasIncomeProducingAssets?: boolean;
  hadFiduciaryChange?: boolean;
  hadAddressChange?: boolean;
  hadResponsiblePartyChange?: boolean;
  hasAuthorizedRep?: boolean; // POA/representative intent

  // Events recorded from workflows:
  events: FilingEvent[];

  // Optional enrichment from user entry:
  notes?: string;
};

export type FilingAwarenessResult = {
  disclaimer: string;
  cards: Array<InstrumentCard & { relevance: Relevance }>;
};








