/**
 * JSON column `campaign_posts.scheduled_publish_meta` — worker + UI (no extra Drizzle columns).
 */

export type ScheduledPublishSource =
  | "manual_schedule"
  | "bentley_launch_mode"
  | "future_auto"
  | "bentley_sequence_apply"
  | "bentley_sync_launch"
  | "bentley_optimization_variant";

export type ScheduledPublishMeta = {
  publishAttemptCount?: number;
  lastPublishAttemptAt?: string;
  nextPublishAttemptAt?: string;
  lastPublishError?: string;
  lastPublishErrorCode?: string;
  scheduledPublishSource?: ScheduledPublishSource;
};

export function parseScheduledPublishMeta(raw: unknown): ScheduledPublishMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const publishAttemptCount =
    typeof o.publishAttemptCount === "number" && Number.isFinite(o.publishAttemptCount)
      ? Math.max(0, Math.floor(o.publishAttemptCount))
      : undefined;
  return {
    publishAttemptCount,
    lastPublishAttemptAt: typeof o.lastPublishAttemptAt === "string" ? o.lastPublishAttemptAt : undefined,
    nextPublishAttemptAt: typeof o.nextPublishAttemptAt === "string" ? o.nextPublishAttemptAt : undefined,
    lastPublishError: typeof o.lastPublishError === "string" ? o.lastPublishError : undefined,
    lastPublishErrorCode: typeof o.lastPublishErrorCode === "string" ? o.lastPublishErrorCode : undefined,
    scheduledPublishSource:
      o.scheduledPublishSource === "manual_schedule" ||
      o.scheduledPublishSource === "bentley_launch_mode" ||
      o.scheduledPublishSource === "future_auto" ||
      o.scheduledPublishSource === "bentley_sequence_apply" ||
      o.scheduledPublishSource === "bentley_sync_launch" ||
      o.scheduledPublishSource === "bentley_optimization_variant"
        ? o.scheduledPublishSource
        : undefined,
  };
}

export function mergeScheduledPublishMeta(
  prev: ScheduledPublishMeta | null | undefined,
  patch: ScheduledPublishMeta
): ScheduledPublishMeta {
  return { ...parseScheduledPublishMeta(prev), ...patch };
}
