/**
 * Named filter/sort views for vault and matters (localStorage, separate from reducer).
 */

import type { ListSortId } from "./listSort";
import type { CaseListFilterState, VaultFilterState } from "./vaultFilters";
import { emptyCaseListFilterState, emptyVaultFilterState } from "./vaultFilters";

const KEY = "hf_fr_saved_views_v1";

export type UserSavedViewVault = {
  id: string;
  name: string;
  filter: VaultFilterState;
  sort: ListSortId;
};

export type UserSavedViewCase = {
  id: string;
  name: string;
  filter: CaseListFilterState;
  sort: ListSortId;
};

export type SavedViewsStore = {
  vault: UserSavedViewVault[];
  cases: UserSavedViewCase[];
};

const DEF_VAULT: UserSavedViewVault[] = [
  {
    id: "builtin-overdue",
    name: "Overdue",
    filter: { ...emptyVaultFilterState(), due: "overdue" },
    sort: "overdue_first",
  },
  {
    id: "builtin-awaiting",
    name: "Awaiting response",
    filter: { ...emptyVaultFilterState(), status: "awaiting_response" },
    sort: "followup_asc",
  },
  {
    id: "builtin-unassigned",
    name: "Unassigned",
    filter: { ...emptyVaultFilterState(), caseId: "__unassigned" },
    sort: "updated_desc",
  },
];

const DEF_CASES: UserSavedViewCase[] = [
  {
    id: "builtin-overdue",
    name: "Overdue",
    filter: { ...emptyCaseListFilterState(), due: "overdue" },
    sort: "overdue_first",
  },
  {
    id: "builtin-due-week",
    name: "Due this week",
    filter: { ...emptyCaseListFilterState(), due: "soon" },
    sort: "followup_asc",
  },
  {
    id: "builtin-awaiting",
    name: "Awaiting response",
    filter: { ...emptyCaseListFilterState(), status: "awaiting_response" },
    sort: "updated_desc",
  },
  {
    id: "builtin-unassigned",
    name: "Unassigned",
    filter: { ...emptyCaseListFilterState(), docs: "none" },
    sort: "updated_desc",
  },
];

function loadStore(): SavedViewsStore {
  if (typeof window === "undefined") return { vault: [], cases: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { vault: [], cases: [] };
    return JSON.parse(raw) as SavedViewsStore;
  } catch {
    return { vault: [], cases: [] };
  }
}

function saveStore(s: SavedViewsStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function listVaultViews(): UserSavedViewVault[] {
  const u = loadStore().vault;
  const ids = new Set(DEF_VAULT.map((d) => d.id));
  const merged = [...DEF_VAULT, ...u.filter((x) => !ids.has(x.id))];
  return merged;
}

export function listCaseViews(): UserSavedViewCase[] {
  const u = loadStore().cases;
  const ids = new Set(DEF_CASES.map((d) => d.id));
  return [...DEF_CASES, ...u.filter((x) => !ids.has(x.id))];
}

export function saveVaultView(name: string, filter: VaultFilterState, sort: ListSortId): void {
  const id = `user-${Date.now()}`;
  const s = loadStore();
  s.vault.push({ id, name: name.trim() || "Saved view", filter, sort });
  saveStore(s);
}

export function saveCaseView(name: string, filter: CaseListFilterState, sort: ListSortId): void {
  const id = `user-${Date.now()}`;
  const s = loadStore();
  s.cases.push({ id, name: name.trim() || "Saved view", filter, sort });
  saveStore(s);
}

export function deleteVaultView(id: string): void {
  if (id.startsWith("builtin-")) return;
  const s = loadStore();
  s.vault = s.vault.filter((x) => x.id !== id);
  saveStore(s);
}

export function deleteCaseView(id: string): void {
  if (id.startsWith("builtin-")) return;
  const s = loadStore();
  s.cases = s.cases.filter((x) => x.id !== id);
  saveStore(s);
}

export function clearSavedViewsStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
