// src/lib/filing-awareness/engine.ts
import {
  FilingAwarenessInput,
  FilingAwarenessResult,
  Relevance,
  FilingInstrumentId,
  EntityContext,
} from "./types";
import { INSTRUMENT_CATALOG, PLATFORM_DISCLAIMER } from "./catalog";

// Re-export for convenience
export type { FilingAwarenessInput, EntityContext } from "./types";

type Rule = {
  instrumentId: FilingInstrumentId;
  when: (i: FilingAwarenessInput) => boolean;
  score: number;
  confidence: Relevance["confidence"];
  reasons: (i: FilingAwarenessInput) => string[];
};

const hasEvent = (i: FilingAwarenessInput, e: any) => (i.events || []).includes(e);

const RULES: Rule[] = [
  // 2848
  {
    instrumentId: "irs_2848",
    when: (i) =>
      i.hasAuthorizedRep === true ||
      hasEvent(i, "authorized_representative_added") ||
      hasEvent(i, "authorized_representative_removed"),
    score: 85,
    confidence: "high",
    reasons: () => ["Authorized representative intent/event indicated."],
  },

  // 56
  {
    instrumentId: "irs_56",
    when: (i) =>
      i.entityContext === "revocable_living_trust" ||
      i.entityContext === "irrevocable_trust" ||
      hasEvent(i, "fiduciary_appointed") ||
      hasEvent(i, "fiduciary_changed") ||
      hasEvent(i, "fiduciary_terminated") ||
      i.hadFiduciaryChange === true,
    score: 70,
    confidence: "medium",
    reasons: (i) => {
      const r: string[] = [];
      if (i.hadFiduciaryChange) r.push("Fiduciary change flagged in workflow.");
      if (hasEvent(i, "fiduciary_appointed")) r.push("Fiduciary appointment event logged.");
      if (hasEvent(i, "fiduciary_changed")) r.push("Fiduciary change event logged.");
      if (hasEvent(i, "fiduciary_terminated")) r.push("Fiduciary termination event logged.");
      return r.length ? r : ["Trust context where fiduciary notices are commonly considered."];
    },
  },

  // 56-F
  {
    instrumentId: "irs_56f",
    when: (i) => hasEvent(i, "foreign_entity_or_nonresident_factor"),
    score: 80,
    confidence: "medium",
    reasons: () => ["Foreign/nonresident factor flagged; refer to specialized tax professional."],
  },

  // 8822-B
  {
    instrumentId: "irs_8822b",
    when: (i) =>
      i.hasEIN === true &&
      (i.hadAddressChange === true ||
        i.hadResponsiblePartyChange === true ||
        hasEvent(i, "address_changed") ||
        hasEvent(i, "responsible_party_changed")),
    score: 90,
    confidence: "high",
    reasons: () => ["EIN present plus address/responsible party change indicated."],
  },

  // 1041
  {
    instrumentId: "irs_1041",
    when: (i) =>
      i.entityContext === "irrevocable_trust" &&
      (i.hasIncomeProducingAssets === true ||
        hasEvent(i, "income_generated") ||
        hasEvent(i, "distributions_made") ||
        hasEvent(i, "tax_year_end")),
    score: 75,
    confidence: "medium",
    reasons: () => ["Irrevocable trust context with income/distribution/tax-year activity indicated."],
  },

  // SS-4 awareness
  {
    instrumentId: "irs_ss4_ein",
    when: (i) =>
      i.hasEIN !== true &&
      (i.hasBankingIntent === true ||
        hasEvent(i, "bank_account_opening") ||
        i.entityContext.startsWith("company_") ||
        i.entityContext === "religious_organization" ||
        i.entityContext === "charitable_foundation"),
    score: 65,
    confidence: "medium",
    reasons: () => ["EIN not present and banking/operations intent indicated."],
  },

  // 1120 awareness for C-Corp
  {
    instrumentId: "irs_1120",
    when: (i) => i.entityContext === "company_c_corp" || i.entityContext === "company_parent_holding",
    score: 55,
    confidence: "low",
    reasons: () => ["Corporate entity context; tax professional determines return requirements based on activity."],
  },

  // 990 series awareness
  {
    instrumentId: "irs_990_series",
    when: (i) => i.entityContext === "charitable_foundation",
    score: 45,
    confidence: "low",
    reasons: () => ["Charitable context; exempt status and filings are determined externally."],
  },

  // State charity registration awareness
  {
    instrumentId: "state_charity_registration",
    when: (i) => i.entityContext === "charitable_foundation" && hasEvent(i, "charitable_solicitation"),
    score: 75,
    confidence: "medium",
    reasons: () => ["Solicitation intent flagged; counsel typically evaluates state registration scope."],
  },

  // Bank packet
  {
    instrumentId: "bank_resolution_packet",
    when: (i) =>
      i.hasBankingIntent === true ||
      hasEvent(i, "bank_account_opening") ||
      i.entityContext.startsWith("company_") ||
      i.entityContext === "religious_organization" ||
      i.entityContext === "charitable_foundation",
    score: 80,
    confidence: "high",
    reasons: () => ["Banking intent/entity context indicates common KYC/authority evidence needs."],
  },
];

export function buildFilingAwareness(i: FilingAwarenessInput): FilingAwarenessResult {
  const hits = new Map<FilingInstrumentId, { relevance: Relevance }>();

  for (const rule of RULES) {
    if (!rule.when(i)) continue;

    const existing = hits.get(rule.instrumentId);
    const reasons = rule.reasons(i);

    if (!existing) {
      hits.set(rule.instrumentId, {
        relevance: { score: rule.score, confidence: rule.confidence, reasons },
      });
    } else {
      // combine scores conservatively; cap at 100
      const nextScore = Math.min(100, existing.relevance.score + Math.floor(rule.score / 3));
      hits.set(rule.instrumentId, {
        relevance: {
          score: nextScore,
          confidence: existing.relevance.confidence === "high" ? "high" : rule.confidence,
          reasons: Array.from(new Set([...existing.relevance.reasons, ...reasons])),
        },
      });
    }
  }

  const cards = Array.from(hits.entries())
    .map(([id, meta]) => ({ ...INSTRUMENT_CATALOG[id], relevance: meta.relevance }))
    .sort((a, b) => b.relevance.score - a.relevance.score);

  return { disclaimer: PLATFORM_DISCLAIMER, cards };
}
