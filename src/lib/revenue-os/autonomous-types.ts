/**
 * Shared autonomous action type strings (DB + engine).
 */

export const BENTLEY_AUTONOMOUS_ACTION_TYPES = [
  "auto_retry_failed_publish",
  "auto_schedule_promoted_winner",
  "auto_archive_stale_draft",
  "auto_create_lead_handoff",
  "auto_run_cadence",
  "auto_sync_published_metrics",
  "auto_suppress_low_confidence_loser",
  "auto_mark_manual_export_needed",
] as const;

export type BentleyAutonomousActionType = (typeof BENTLEY_AUTONOMOUS_ACTION_TYPES)[number];

export function isBentleyAutonomousActionType(s: string): s is BentleyAutonomousActionType {
  return (BENTLEY_AUTONOMOUS_ACTION_TYPES as readonly string[]).includes(s);
}
