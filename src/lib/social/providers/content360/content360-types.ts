export const CONTENT360_PROVIDER_ID = "content360" as const;

export type Content360ConnectionStatus = "pending" | "active" | "error" | "revoked";

export type Content360VerifyResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
  checkedAt: string;
};

export type Content360ScheduleResult = {
  ok: boolean;
  simulated?: boolean;
  externalScheduleId?: string | null;
  externalPostId?: string | null;
  raw?: Record<string, unknown>;
  message?: string;
};

/** One row in a Content360 batch schedule response (or per-post fallback). */
export type Content360BatchScheduleItemResult = Content360ScheduleResult & {
  campaignPostId: string;
};

export type Content360ScheduleBatchResult = {
  usedBatchEndpoint: boolean;
  providerBatchId?: string | null;
  items: Content360BatchScheduleItemResult[];
  raw?: Record<string, unknown>;
};

export type Content360JobStatusResult = {
  ok: boolean;
  skipped?: boolean;
  state?: string;
  raw?: Record<string, unknown>;
};

export type Content360CancelResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
};
