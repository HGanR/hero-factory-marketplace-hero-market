import type { ClientProviderConnectionRow, ProviderPublishJobRow } from "@/lib/db/schema";

export type Content360SyncDisposition =
  | "published"
  | "scheduled"
  | "failed"
  | "canceled"
  | "unconfigured"
  | "unknown";

export type Content360SyncNormalized = {
  disposition: Content360SyncDisposition;
  externalPostId?: string;
  message?: string;
  skipped?: boolean;
  raw: Record<string, unknown>;
};

export type Content360ExecuteOutcome =
  | { kind: "published"; platformPostId: string; raw?: Record<string, unknown> }
  | { kind: "awaiting_remote"; providerStatus: string; raw?: Record<string, unknown> }
  | { kind: "failed_terminal"; code: string; message: string; raw?: Record<string, unknown> }
  | { kind: "failed_retryable"; code: string; message: string; raw?: Record<string, unknown> };

export type Content360ExecuteScheduledPublishInput = {
  connection: ClientProviderConnectionRow;
  job: ProviderPublishJobRow;
};
