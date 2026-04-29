import type {
  CaseModule,
  DocumentLifecycleStatus,
  FrCase,
  FrModule,
  VaultDocument,
  VaultDocumentType,
} from "./vaultTypes";

export type VaultFilterState = {
  search: string;
  status: DocumentLifecycleStatus | "";
  type: VaultDocumentType | "";
  module: FrModule | "";
  caseId: string | "";
  tag: string;
  due: "" | "soon" | "overdue";
};

export const emptyVaultFilterState = (): VaultFilterState => ({
  search: "",
  status: "",
  type: "",
  module: "",
  caseId: "",
  tag: "",
  due: "",
});

const SOON_DAYS = 7;

export function filterDocuments(docs: VaultDocument[], f: VaultFilterState, today: string): VaultDocument[] {
  const q = f.search.trim().toLowerCase();
  const soonCut = new Date(today + "T12:00:00");
  soonCut.setDate(soonCut.getDate() + SOON_DAYS);
  const soonStr = soonCut.toISOString().slice(0, 10);

  return docs.filter((d) => {
    if (f.status && d.status !== f.status) return false;
    if (f.type && d.type !== f.type) return false;
    if (f.module && d.module !== f.module) return false;
    if (f.caseId === "__unassigned") {
      if (d.caseId !== null) return false;
    } else if (f.caseId && d.caseId !== f.caseId) return false;
    if (f.tag && !d.tags.some((t) => t.toLowerCase().includes(f.tag.toLowerCase()))) return false;
    if (f.due === "overdue") {
      if (!d.followUpDueAt || d.followUpDueAt >= today) return false;
    }
    if (f.due === "soon") {
      if (!d.followUpDueAt || d.followUpDueAt < today || d.followUpDueAt > soonStr) return false;
    }
    if (q) {
      const inParty = d.primaryParty.toLowerCase().includes(q);
      const inPreview = d.text.toLowerCase().includes(q);
      if (!inParty && !inPreview) return false;
    }
    return true;
  });
}

export type CaseListFilterState = {
  search: string;
  status: DocumentLifecycleStatus | "";
  module: CaseModule | "";
  tag: string;
  due: "" | "soon" | "overdue";
  /** Matters with no letters attached (operational “unassigned”). */
  docs: "" | "none";
};

export const emptyCaseListFilterState = (): CaseListFilterState => ({
  search: "",
  status: "",
  module: "",
  tag: "",
  due: "",
  docs: "",
});

export function filterCasesForList(cases: FrCase[], f: CaseListFilterState, today: string): FrCase[] {
  const q = f.search.trim().toLowerCase();
  const soonCut = new Date(today + "T12:00:00");
  soonCut.setDate(soonCut.getDate() + SOON_DAYS);
  const soonStr = soonCut.toISOString().slice(0, 10);

  return cases.filter((c) => {
    if (f.status && c.status !== f.status) return false;
    if (f.module && c.module !== f.module) return false;
    if (f.tag && !c.tags.some((t) => t.toLowerCase().includes(f.tag.toLowerCase()))) return false;
    if (f.due === "overdue") {
      if (!c.followUpDueAt || c.followUpDueAt >= today) return false;
    }
    if (f.due === "soon") {
      if (!c.followUpDueAt || c.followUpDueAt < today || c.followUpDueAt > soonStr) return false;
    }
    if (f.docs === "none" && c.documentIds.length > 0) return false;
    if (q) {
      const hit =
        c.label.toLowerCase().includes(q) ||
        c.primaryParty.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}
