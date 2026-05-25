/**
 * Debug markers for Bentley → dashboard continuity (enable with `localStorage.bentley_debug = "1"` or `?bentley_debug=1`).
 */

export type BentleyContinuityPhase =
  | "intake_saved"
  | "dashboard_hydrated"
  | "autorun_requested"
  | "full_analysis_started"
  | "full_analysis_completed"
  | "campaign_brief_generated"
  | "launch_card_hydrated"
  | "launch_card_ready"
  | "pipeline_stage_transition"
  | "pipeline_resume"
  | "platform_connection_state_resolved"
  | "campaign_persisted_db"
  | "campaign_persist_db_failed"
  | "campaign_posts_created"
  | "campaign_posts_create_failed"
  | "campaign_posts_scheduled"
  | "campaign_posts_schedule_failed"
  | "launch_ready_completed"
  | "bentley_launch_mismatch"
  | "launch_finalize_blocked_empty_posts";

function continuityDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("bentley_debug") === "1") return true;
    return new URLSearchParams(window.location.search).get("bentley_debug") === "1";
  } catch {
    return false;
  }
}

export function bentleyContinuityLog(phase: BentleyContinuityPhase, detail?: Record<string, unknown>): void {
  if (!continuityDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(`[BentleyContinuity:${phase}]`, { t: Date.now(), ...detail });
  } catch {
    // ignore
  }
}
