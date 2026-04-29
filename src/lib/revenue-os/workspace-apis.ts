/**
 * Server-side helper to fetch workspace API configs for Revenue OS flows.
 * Use only in API routes. Never expose decrypted secrets to the client.
 */
import { getDb } from "@/lib/db";
import { ensureRevenueOsWorkspaceApisTable } from "@/lib/db/revenue-os-workspace-apis-ensure";
import { revenueOsWorkspaceApis } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/social/encrypt";

export type WorkspaceApiConfig = {
  id: string;
  provider: string;
  label: string | null;
  endpointUrl: string | null;
  apiKey: string;
};

/**
 * Fetch workspace APIs with decrypted credentials for the given workspace.
 * Returns empty array if table does not exist or no configs match.
 */
export async function getWorkspaceApisWithSecrets(
  userId: string,
  clientId: string,
  trustId: string
): Promise<WorkspaceApiConfig[]> {
  try {
    await ensureRevenueOsWorkspaceApisTable();
    const db = await getDb();
    const rows = await db
      .select({
        id: revenueOsWorkspaceApis.id,
        provider: revenueOsWorkspaceApis.provider,
        label: revenueOsWorkspaceApis.label,
        endpointUrl: revenueOsWorkspaceApis.endpointUrl,
        apiKeyEnc: revenueOsWorkspaceApis.apiKeyEnc,
      })
      .from(revenueOsWorkspaceApis)
      .where(
        and(
          eq(revenueOsWorkspaceApis.userId, String(userId)),
          eq(revenueOsWorkspaceApis.clientId, clientId ?? ""),
          eq(revenueOsWorkspaceApis.trustId, trustId ?? "")
        )
      );

    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      label: r.label,
      endpointUrl: r.endpointUrl,
      apiKey: r.apiKeyEnc ? decryptToken(r.apiKeyEnc) : "",
    }));
  } catch {
    return [];
  }
}

/**
 * Get list of connected provider names (no secrets). For including in API responses.
 */
export async function getConnectedProviders(
  userId: string,
  clientId: string,
  trustId: string
): Promise<string[]> {
  const configs = await getWorkspaceApisWithSecrets(userId, clientId ?? "", trustId ?? "");
  return configs.map((c) => c.provider).filter(Boolean);
}
