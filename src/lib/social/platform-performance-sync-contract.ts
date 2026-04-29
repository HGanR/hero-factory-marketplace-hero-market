/**
 * Contract for platform analytics sync jobs (adapters + worker).
 * Keeps metric shapes consistent across connectors and deployment feedback.
 */

export type PlatformPerformanceSnapshot = {
  platform: string;
  externalPostId?: string | null;
  /** When the platform reported or we captured this snapshot (ISO 8601). */
  capturedAt: string;
  impressions?: number | null;
  /** Distinct from impressions when the API exposes both (e.g. Instagram insights). */
  reach?: number | null;
  clicks?: number | null;
  /** Composite or platform-native engagement index when provided */
  engagement?: number | null;
  /** Like / reaction count when the API exposes it separately from `engagement`. */
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  leads?: number | null;
  /** Video plays when the API exposes them (e.g. Instagram `video_views`). */
  videoViews?: number | null;
  ctr?: number | null;
  cpc?: number | null;
};

export type PlatformPerformanceSyncResult = {
  ok: boolean;
  platform: string;
  snapshots: PlatformPerformanceSnapshot[];
  errorMessage?: string | null;
};

/** Per-post fetch outcome from a platform adapter. */
export type PlatformPostPerformanceFetchStatus =
  | { status: "ok"; snapshot: PlatformPerformanceSnapshot }
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string };

/** Declared support for metric sync (UI / debug; adapters may still return unsupported at runtime). */
export type PlatformMetricSyncSupportState = "live" | "stub_unsupported" | "no_adapter";
