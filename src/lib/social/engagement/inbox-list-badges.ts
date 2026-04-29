import type { ThreadWithPreview } from "./upsert-social-engagement";

/** Precomputed badge hints for Inbox list rows (avoids re-deriving in the client). */
export function inboxListRowBadges(t: ThreadWithPreview) {
  return {
    isManual: Boolean(t.requiresManual || t.status === "manual_only"),
    hasLabels: (t.labelSlugs?.length ?? 0) > 0,
    isAssigned: Boolean(t.hasOpenAssignment),
    isHighSignal: t.intent === "complaint" || t.intent === "lead" || t.urgency === "high",
    needsManualAttention: Boolean(t.requiresManual || t.status === "manual_only"),
  };
}
