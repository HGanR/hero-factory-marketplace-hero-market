import { and, desc, eq } from "drizzle-orm";

import { clientProviderConnections } from "@/lib/db/schema";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import {
  evaluateContent360Env,
  isContent360FeatureEnabled,
  isContent360VendorCancelImplemented,
  isContent360VendorSyncImplemented,
} from "@/lib/social/providers/content360/content360-env";

export type Content360ReadinessResponse = {
  providerConfigured: boolean;
  featureEnabled: boolean;
  hasConnection: boolean;
  connectionStatus: string;
  canScheduleSingle: boolean;
  canScheduleBatch: boolean;
  canCancel: boolean;
  canSyncStatus: boolean;
  missingConfig: string[];
  warnings: string[];
};

/**
 * Builds readiness for GET /api/revenue-os/content360/readiness (auth + client ownership already enforced).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildContent360ReadinessForClient(db: any, clientId: string): Promise<Content360ReadinessResponse> {
  const env = evaluateContent360Env();

  const rows = await db
    .select({
      connectionStatus: clientProviderConnections.connectionStatus,
    })
    .from(clientProviderConnections)
    .where(and(eq(clientProviderConnections.clientId, clientId), eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID)))
    .orderBy(desc(clientProviderConnections.updatedAt))
    .limit(1);

  const hasConnection = rows.length > 0;
  const connectionStatus = hasConnection ? String(rows[0]!.connectionStatus ?? "unknown") : "none";

  const featureEnabled = isContent360FeatureEnabled();
  const providerConfigured = env.providerConfigured;

  const canScheduleSingle = featureEnabled && hasConnection && providerConfigured;
  const canScheduleBatch = canScheduleSingle;
  const canCancel = featureEnabled && hasConnection && providerConfigured && isContent360VendorCancelImplemented();
  const canSyncStatus = featureEnabled && hasConnection && providerConfigured && isContent360VendorSyncImplemented();

  const missingList = [...env.missing];
  if (!featureEnabled) {
    missingList.push("CONTENT360_ENABLED");
  }
  if (featureEnabled && !hasConnection) {
    missingList.push("CONTENT360_CONNECTION");
  }
  const missingConfig = [...new Set(missingList)];

  const warnings = [...env.warnings];
  if (!featureEnabled) {
    warnings.push("CONTENT360_ENABLED is not set to true — scheduling is off for this deployment.");
  }

  return {
    providerConfigured,
    featureEnabled,
    hasConnection,
    connectionStatus,
    canScheduleSingle,
    canScheduleBatch,
    canCancel,
    canSyncStatus,
    missingConfig,
    warnings,
  };
}
