/**
 * Auth for POST /api/internal/scheduled-publish/run (cron / workers).
 */

export {
  getInternalCronWorkerSecrets as getScheduledPublishWorkerSecrets,
  isAuthorizedInternalCronRequest as isAuthorizedScheduledPublishRequest,
} from "@/lib/social/internal-worker-cron-auth";
