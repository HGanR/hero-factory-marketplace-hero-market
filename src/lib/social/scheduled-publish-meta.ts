/**
 * JSON column `campaign_posts.scheduled_publish_meta` — worker + UI (no extra Drizzle columns).
 */

export type ScheduledPublishSource =
  | "manual_schedule"
  | "bentley_launch_mode"
  | "future_auto"
  | "bentley_sequence_apply"
  | "bentley_sync_launch"
  | "bentley_optimization_variant"
  | "bentley_weekly_batch";

export type PublishRoute = "native" | "content360" | "manual" | "export_only";

export type ScheduledPublishMeta = {
  publishAttemptCount?: number;
  lastPublishAttemptAt?: string;
  nextPublishAttemptAt?: string;
  lastPublishError?: string;
  lastPublishErrorCode?: string;
  scheduledPublishSource?: ScheduledPublishSource;
  /** Route for outbound publish — native OAuth adapters vs third-party routers (Content360). */
  publishRoute?: PublishRoute;
  provider?: string;
  providerConnectionId?: string;
  providerPublishJobId?: string;
  /** Optional Content360 weekly batch row id. */
  content360BatchId?: string;
  weeklyBatch?: boolean;
  externalScheduleId?: string;
  externalPostId?: string;
  targetPlatform?: string;
  timezone?: string;
  providerStatus?: string;
  /** When true, worker / cron should not treat this post as due for Content360/native publish. */
  content360ScheduleCanceled?: boolean;
  /**
   * Set when the post was published (or attempted) via centralized platform `CONTENT360_API_KEY`
   * (`publishContent360Post`), not the per-client OAuth Content360 job worker.
   */
  content360PlatformPublish?: boolean;
  /** Sanitized vendor JSON snapshot for admin lineage (keep small — avoid huge blobs). */
  content360ProviderResponse?: Record<string, unknown>;
  /**
   * When true, the scheduled worker may publish via centralized `CONTENT360_API_KEY`
   * (`publishContent360Post`) instead of per-client OAuth jobs.
   * **Server-written only** — never accept from user PATCH bodies.
   */
  content360PlatformScheduled?: boolean;
};

function parsePublishRoute(v: unknown): PublishRoute | undefined {
  if (v === "native" || v === "content360" || v === "manual" || v === "export_only") return v;
  return undefined;
}

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
      o.scheduledPublishSource === "bentley_optimization_variant" ||
      o.scheduledPublishSource === "bentley_weekly_batch"
        ? o.scheduledPublishSource
        : undefined,
    publishRoute: parsePublishRoute(o.publishRoute),
    provider: typeof o.provider === "string" ? o.provider : undefined,
    providerConnectionId: typeof o.providerConnectionId === "string" ? o.providerConnectionId : undefined,
    providerPublishJobId: typeof o.providerPublishJobId === "string" ? o.providerPublishJobId : undefined,
    content360BatchId: typeof o.content360BatchId === "string" ? o.content360BatchId : undefined,
    weeklyBatch: typeof o.weeklyBatch === "boolean" ? o.weeklyBatch : undefined,
    externalScheduleId: typeof o.externalScheduleId === "string" ? o.externalScheduleId : undefined,
    externalPostId: typeof o.externalPostId === "string" ? o.externalPostId : undefined,
    targetPlatform: typeof o.targetPlatform === "string" ? o.targetPlatform : undefined,
    timezone: typeof o.timezone === "string" ? o.timezone : undefined,
    providerStatus: typeof o.providerStatus === "string" ? o.providerStatus : undefined,
    content360ScheduleCanceled: typeof o.content360ScheduleCanceled === "boolean" ? o.content360ScheduleCanceled : undefined,
    content360PlatformPublish: typeof o.content360PlatformPublish === "boolean" ? o.content360PlatformPublish : undefined,
    content360ProviderResponse:
      o.content360ProviderResponse && typeof o.content360ProviderResponse === "object" && !Array.isArray(o.content360ProviderResponse)
        ? (o.content360ProviderResponse as Record<string, unknown>)
        : undefined,
    content360PlatformScheduled: typeof o.content360PlatformScheduled === "boolean" ? o.content360PlatformScheduled : undefined,
  };
}

/** Sources the worker trusts for `content360PlatformScheduled` (defense in depth vs forged DB rows). */
const CONTENT360_PLATFORM_SCHEDULE_TRUSTED_SOURCES = new Set<ScheduledPublishSource>([
  "bentley_sync_launch",
  "bentley_launch_mode",
  "bentley_weekly_batch",
  "bentley_optimization_variant",
]);

/**
 * True when meta requests platform-key scheduled publish and passes trust checks
 * (`publishRoute`, no per-client job id, trusted `scheduledPublishSource`).
 */
export function isContent360PlatformScheduleTrustedMeta(meta: ScheduledPublishMeta): boolean {
  if (meta.publishRoute !== "content360" || !meta.content360PlatformScheduled) return false;
  if (meta.providerPublishJobId?.trim()) return false;
  const src = meta.scheduledPublishSource;
  if (!src) return false;
  return CONTENT360_PLATFORM_SCHEDULE_TRUSTED_SOURCES.has(src);
}

/** Keys that must never be merged from user-controlled campaign post PATCH payloads. */
export const SERVER_WRITTEN_SCHEDULED_PUBLISH_META_KEYS = ["content360PlatformScheduled"] as const;

export function stripServerWrittenScheduledPublishMetaForUserMerge(meta: Record<string, unknown>): Record<string, unknown> {
  const o = { ...meta };
  for (const k of SERVER_WRITTEN_SCHEDULED_PUBLISH_META_KEYS) {
    delete o[k];
  }
  return o;
}

export function mergeScheduledPublishMeta(
  prev: ScheduledPublishMeta | null | undefined,
  patch: ScheduledPublishMeta
): ScheduledPublishMeta {
  return { ...parseScheduledPublishMeta(prev), ...patch };
}

/**
 * Merge typed publish meta into the raw JSON column while **preserving unknown keys**
 * (e.g. future Bentley-only keys) that are not part of {@link ScheduledPublishMeta}.
 */
export function mergeRawScheduledPublishMeta(
  existingRaw: unknown,
  patch: ScheduledPublishMeta
): Record<string, unknown> {
  const base =
    existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
      ? { ...(existingRaw as Record<string, unknown>) }
      : {};
  const typed = mergeScheduledPublishMeta(parseScheduledPublishMeta(base), patch);
  return { ...base, ...typed };
}
