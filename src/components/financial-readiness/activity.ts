/**
 * Append-only activity feed for cases and documents (persisted in reducer state).
 */

export type ActivityKind =
  | "case_created"
  | "document_generated"
  | "document_edited"
  | "document_status_changed"
  | "document_followup_changed"
  | "document_detached"
  | "document_reassigned"
  | "case_status_changed"
  | "case_followup_changed"
  | "interaction_logged"
  | "next_action_changed"
  | "operational"
  | "bulk_vault"
  | "bulk_cases"
  | "bulk_undo";

export type ActivityEntry = {
  id: string;
  at: string;
  caseId: string | null;
  documentId: string | null;
  kind: ActivityKind;
  summary: string;
  payload?: Record<string, unknown>;
};

const MAX_ACTIVITIES = 500;

type ActivityAware = { activities: ActivityEntry[] };

export function appendActivity<S extends ActivityAware>(
  state: S,
  entry: Omit<ActivityEntry, "id" | "at">
): S {
  const now = new Date().toISOString();
  const a: ActivityEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: now,
    ...entry,
  };
  return { ...state, activities: [a, ...state.activities].slice(0, MAX_ACTIVITIES) };
}
