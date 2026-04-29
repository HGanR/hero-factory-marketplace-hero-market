import type { CaseListFilterState, VaultFilterState } from "./vaultFilters";
import type { CasesFocusParam } from "./casesFocus";

export function vaultFilteredEmptyHint(f: VaultFilterState): string {
  if (f.search.trim()) return "No letters match search — try fewer words or clear filters.";
  if (f.status) return "No letters with this status — pick another status or reset.";
  if (f.due === "overdue") return "No overdue letters in the vault — you’re current on follow-ups.";
  if (f.due === "soon") return "Nothing due in the next week for this filter.";
  if (f.caseId === "__unassigned") return "All filtered letters are assigned to a matter.";
  if (f.caseId) return "No letters on that matter with these filters.";
  return "No letters match — widen filters or generate a new letter from Optimization / Resolution.";
}

export function casesFilteredEmptyHint(
  f: CaseListFilterState,
  focus: CasesFocusParam | null
): string {
  if (focus === "overdue") return "No overdue matters — keep monitoring follow-up dates.";
  if (focus === "awaiting_response") return "Nothing awaiting response — update statuses when mail arrives.";
  if (focus === "escalated") return "No escalated matters in view.";
  if (focus === "due_this_week") return "No matters due this week — check overdue or clear focus.";
  if (f.search.trim()) return "No matters match search — try another term.";
  if (f.status) return "No matters with this status — adjust filters.";
  if (f.due === "overdue") return "No overdue matters — you’re on top of dates.";
  if (f.docs === "none") return "No matters without letters — attach letters from the vault or create a matter from a letter.";
  return "No matters match — reset filters or create a matter from a letter.";
}
