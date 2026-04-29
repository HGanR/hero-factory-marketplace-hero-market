import type { FrCase, VaultDocument } from "./vaultTypes";

export type ListSortId = "updated_desc" | "created_desc" | "followup_asc" | "overdue_first";

const DATE_MAX = "9999-12-31";

function docOverdue(d: VaultDocument, today: string): boolean {
  return (
    !!d.followUpDueAt &&
    d.followUpDueAt < today &&
    d.status !== "completed" &&
    d.status !== "escalated"
  );
}

function caseOverdue(c: FrCase, today: string): boolean {
  return (
    !!c.followUpDueAt &&
    c.followUpDueAt < today &&
    c.status !== "completed" &&
    c.status !== "escalated"
  );
}

export function sortVaultDocuments(docs: VaultDocument[], sort: ListSortId, today: string): VaultDocument[] {
  const arr = [...docs];
  switch (sort) {
    case "updated_desc":
      return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "created_desc":
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "followup_asc":
      return arr.sort((a, b) => {
        const ad = a.followUpDueAt ?? DATE_MAX;
        const bd = b.followUpDueAt ?? DATE_MAX;
        return ad.localeCompare(bd);
      });
    case "overdue_first":
      return arr.sort((a, b) => {
        const ao = docOverdue(a, today) ? 0 : 1;
        const bo = docOverdue(b, today) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    default:
      return arr;
  }
}

export function sortCases(cases: FrCase[], sort: ListSortId, today: string): FrCase[] {
  const arr = [...cases];
  switch (sort) {
    case "updated_desc":
      return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "created_desc":
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "followup_asc":
      return arr.sort((a, b) => {
        const ad = a.followUpDueAt ?? DATE_MAX;
        const bd = b.followUpDueAt ?? DATE_MAX;
        return ad.localeCompare(bd);
      });
    case "overdue_first":
      return arr.sort((a, b) => {
        const ao = caseOverdue(a, today) ? 0 : 1;
        const bo = caseOverdue(b, today) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    default:
      return arr;
  }
}

export const LIST_SORT_OPTIONS: { id: ListSortId; label: string }[] = [
  { id: "updated_desc", label: "Most recently updated" },
  { id: "created_desc", label: "Newest created" },
  { id: "followup_asc", label: "Follow-up due soonest" },
  { id: "overdue_first", label: "Overdue first" },
];
