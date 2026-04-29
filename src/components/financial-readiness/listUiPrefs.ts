/**
 * Persists vault + matter list UI (sort, filters) in localStorage — separate from reducer state.
 */

import { clearSavedViewsStorage } from "./savedViews";
import type { ListSortId } from "./listSort";
import type { CaseListFilterState, VaultFilterState } from "./vaultFilters";
import { emptyCaseListFilterState, emptyVaultFilterState } from "./vaultFilters";

const KEY = "hf_fr_list_ui_v1";

export type SavedListUi = {
  vaultSort: ListSortId;
  vaultFilter: VaultFilterState;
  caseSort: ListSortId;
  caseFilter: CaseListFilterState;
};

export function loadListUiPrefs(): Partial<SavedListUi> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SavedListUi>;
  } catch {
    return {};
  }
}

export function saveVaultListUi(vaultSort: ListSortId, vaultFilter: VaultFilterState): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadListUiPrefs();
    window.localStorage.setItem(KEY, JSON.stringify({ ...prev, vaultSort, vaultFilter }));
  } catch {
    /* quota */
  }
}

export function saveCasesListUi(caseSort: ListSortId, caseFilter: CaseListFilterState): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadListUiPrefs();
    window.localStorage.setItem(KEY, JSON.stringify({ ...prev, caseSort, caseFilter }));
  } catch {
    /* quota */
  }
}

export function mergeVaultFilterFromPrefs(partial?: Partial<VaultFilterState>): VaultFilterState {
  return { ...emptyVaultFilterState(), ...(partial ?? {}) };
}

export function mergeCaseFilterFromPrefs(partial?: Partial<CaseListFilterState>): CaseListFilterState {
  return { ...emptyCaseListFilterState(), ...(partial ?? {}) };
}

export function clearListUiPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  clearSavedViewsStorage();
}
