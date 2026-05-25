import type { ClientProviderConnectionRow, ProviderPublishBatchRow, ProviderPublishJobRow } from "@/lib/db/schema";

export type PublicProviderPublishBatch = {
  id: string;
  userId: string;
  clientId: string;
  campaignId: string;
  provider: string;
  connectionId: string;
  status: string;
  totalPosts: number;
  scheduledCount: number;
  failedCount: number;
  timezone: string;
  providerBatchId: string | null;
  providerResponseJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function toPublicProviderPublishBatch(row: ProviderPublishBatchRow): PublicProviderPublishBatch {
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    campaignId: row.campaignId,
    provider: row.provider,
    connectionId: row.connectionId,
    status: row.status,
    totalPosts: row.totalPosts,
    scheduledCount: row.scheduledCount,
    failedCount: row.failedCount,
    timezone: row.timezone,
    providerBatchId: row.providerBatchId ?? null,
    providerResponseJson: (row.providerResponseJson as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export type PublicClientProviderConnection = {
  id: string;
  clientId: string;
  provider: string;
  accountName: string;
  externalAccountId: string | null;
  connectionStatus: string;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPublicClientProviderConnection(row: ClientProviderConnectionRow): PublicClientProviderConnection {
  return {
    id: row.id,
    clientId: row.clientId,
    provider: row.provider,
    accountName: row.accountName,
    externalAccountId: row.externalAccountId ?? null,
    connectionStatus: row.connectionStatus,
    lastVerifiedAt:
      row.lastVerifiedAt instanceof Date
        ? row.lastVerifiedAt.toISOString()
        : row.lastVerifiedAt
          ? String(row.lastVerifiedAt)
          : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export function toPublicProviderPublishJob(row: ProviderPublishJobRow): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    campaignId: row.campaignId,
    campaignPostId: row.campaignPostId,
    batchId: row.batchId ?? null,
    assetId: row.assetId ?? null,
    connectionId: row.connectionId,
    provider: row.provider,
    targetPlatform: row.targetPlatform,
    caption: row.caption,
    hashtags: row.hashtags ?? null,
    scheduledAt: row.scheduledAt instanceof Date ? row.scheduledAt.toISOString() : String(row.scheduledAt),
    timezone: row.timezone,
    providerPayloadJson: row.providerPayloadJson ?? null,
    providerResponseJson: row.providerResponseJson ?? null,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
    attempts: row.attempts,
    lastAttemptAt:
      row.lastAttemptAt instanceof Date
        ? row.lastAttemptAt.toISOString()
        : row.lastAttemptAt
          ? String(row.lastAttemptAt)
          : null,
    externalScheduleId: row.externalScheduleId ?? null,
    externalPostId: row.externalPostId ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}
