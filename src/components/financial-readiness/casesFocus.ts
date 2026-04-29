import type { CaseListFilterState } from "./vaultFilters";

export type CasesFocusParam = "overdue" | "due_this_week" | "escalated" | "awaiting_response";

const BASE = "/financial-readiness/cases";

/** Map hub urgency tile → query param value. */
export function casesHrefWithFocus(focus: CasesFocusParam): string {
  return `${BASE}?focus=${focus}`;
}

/** Apply `?focus=` from the URL onto an empty case list filter. */
export function caseFilterFromFocusParam(focus: string | null): Partial<CaseListFilterState> | null {
  switch (focus) {
    case "overdue":
      return { due: "overdue", status: "" };
    case "due_this_week":
      return { due: "soon", status: "" };
    case "escalated":
      return { status: "escalated", due: "" };
    case "awaiting_response":
      return { status: "awaiting_response", due: "" };
    default:
      return null;
  }
}

export function focusLabel(focus: CasesFocusParam): string {
  switch (focus) {
    case "overdue":
      return "Overdue matters";
    case "due_this_week":
      return "Due this week";
    case "escalated":
      return "Escalated";
    case "awaiting_response":
      return "Awaiting response";
  }
}
