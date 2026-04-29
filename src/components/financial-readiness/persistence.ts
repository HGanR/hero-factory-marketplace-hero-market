/**
 * Browser persistence for Financial Readiness — no extra dependencies.
 */

import { migrateV2ToV3, migrateVaultDocumentFromLegacy } from "./migrateState";
import { FR_PERSIST_VERSION, initialFinancialReadinessState, type FinancialReadinessState } from "./state";

const STORAGE_KEY_V3 = "hf_financial_readiness_v3";
const STORAGE_KEY_V2 = "hf_financial_readiness_v2";

export function loadFinancialReadinessState(): FinancialReadinessState | null {
  if (typeof window === "undefined") return null;
  try {
    const v3 = window.localStorage.getItem(STORAGE_KEY_V3);
    if (v3) {
      const parsed = JSON.parse(v3) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      return mergeWithDefaults(parsed as Partial<FinancialReadinessState>);
    }
    const v2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const migrated = mergeWithDefaults(migrateV2ToV3(parsed as Partial<FinancialReadinessState>));
      try {
        window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFinancialReadinessState(state: FinancialReadinessState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: FinancialReadinessState = {
      ...state,
      meta: {
        ...state.meta,
        version: FR_PERSIST_VERSION,
        updatedAt: new Date().toISOString(),
      },
    };
    window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearFinancialReadinessStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_V3);
    window.localStorage.removeItem(STORAGE_KEY_V2);
  } catch {
    /* ignore */
  }
}

/** Merge persisted partial state with defaults so new fields hydrate safely. */
export function mergeWithDefaults(partial: Partial<FinancialReadinessState>): FinancialReadinessState {
  const base = initialFinancialReadinessState;
  return {
    meta: { ...base.meta, ...partial.meta },
    hub: { ...base.hub, ...partial.hub },
    cases: Array.isArray(partial.cases) ? partial.cases : base.cases,
    activities: Array.isArray(partial.activities) ? partial.activities : base.activities,
    documents: Array.isArray(partial.documents)
      ? partial.documents.map((x) => migrateVaultDocumentFromLegacy(x as Parameters<typeof migrateVaultDocumentFromLegacy>[0]))
      : base.documents,
    foundation: {
      ...base.foundation,
      ...partial.foundation,
      utilization: {
        ...base.foundation.utilization,
        ...partial.foundation?.utilization,
      },
      checklist: { ...base.foundation.checklist, ...partial.foundation?.checklist },
      stepCompletion: { ...base.foundation.stepCompletion, ...partial.foundation?.stepCompletion },
    },
    optimization: {
      ...base.optimization,
      ...partial.optimization,
      activeCaseId:
        partial.optimization?.activeCaseId !== undefined
          ? partial.optimization.activeCaseId
          : base.optimization.activeCaseId,
      dispute: { ...base.optimization.dispute, ...partial.optimization?.dispute },
      disputeMeta: { ...base.optimization.disputeMeta, ...partial.optimization?.disputeMeta },
      creditorVerification: {
        ...base.optimization.creditorVerification,
        ...partial.optimization?.creditorVerification,
      },
      negativeItems: Array.isArray(partial.optimization?.negativeItems)
        ? partial.optimization!.negativeItems!
        : base.optimization.negativeItems,
    },
    resolution: {
      ...base.resolution,
      ...partial.resolution,
      activeCaseId:
        partial.resolution?.activeCaseId !== undefined
          ? partial.resolution.activeCaseId
          : base.resolution.activeCaseId,
      validationSources: {
        ...base.resolution.validationSources,
        ...partial.resolution?.validationSources,
      },
      ceaseSources: { ...base.resolution.ceaseSources, ...partial.resolution?.ceaseSources },
      interactions: Array.isArray(partial.resolution?.interactions)
        ? partial.resolution!.interactions!.map((e) => ({
            ...e,
            caseId: e.caseId ?? null,
          }))
        : base.resolution.interactions,
      stepCompletion: { ...base.resolution.stepCompletion, ...partial.resolution?.stepCompletion },
    },
  };
}
