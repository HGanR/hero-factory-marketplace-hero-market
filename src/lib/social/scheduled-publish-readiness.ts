/**
 * Product readiness copy for scheduled publishing (UI / Bentley).
 */

export type ScheduledPublishReadiness = {
  supportsScheduling: boolean;
  blockers: string[];
  nextInfrastructureNeed: string[];
};

/**
 * Executor + internal route ship with the codebase; ops still need cron + env secret.
 */
export function getScheduledPublishReadiness(): ScheduledPublishReadiness {
  const nextInfrastructureNeed = [
    "Configure `SCHEDULED_PUBLISH_WORKER_SECRET` (or reuse `CRON_SECRET`) in the host environment.",
    "Call `POST /api/internal/scheduled-publish/run` every 1–5 minutes with header `x-scheduled-publish-secret` (or `x-cron-secret`).",
    "Monitor `campaign_audit_events` for `scheduled_publish_*` actions.",
  ];

  return {
    supportsScheduling: true,
    blockers: [],
    nextInfrastructureNeed,
  };
}
