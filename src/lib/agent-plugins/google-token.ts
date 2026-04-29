import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentPluginCredentials } from "@/lib/db/schema";
import { encryptToken, decryptToken } from "@/lib/social/encrypt";
import { getGoogleAgentClientId, getGoogleAgentClientSecret } from "@/lib/agent-plugins/google-config";
import { sanitizeTokenRefreshErrorForStorage } from "@/lib/agent-plugins/google-api-errors";

const PROVIDER_GOOGLE = "google";

/**
 * OAuth tokens for agent plugins are keyed strictly by `agentId`.
 * Never mix tokens across agents — all reads/writes filter `agentId` + `provider`.
 */
export async function getValidGoogleAccessTokenForAgent(agentId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(agentPluginCredentials)
    .where(and(eq(agentPluginCredentials.agentId, agentId), eq(agentPluginCredentials.provider, PROVIDER_GOOGLE)))
    .limit(1);

  if (!row?.refreshTokenEnc) return null;

  const refreshPlain = decryptToken(row.refreshTokenEnc);
  if (!refreshPlain) return null;

  const clientId = getGoogleAgentClientId();
  const clientSecret = getGoogleAgentClientSecret();
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  const skewMs = 90_000;
  const expiresMs = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;

  if (row.accessTokenEnc && expiresMs > now + skewMs) {
    const access = decryptToken(row.accessTokenEnc);
    if (access) return access;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshPlain,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !json.access_token) {
    const code = sanitizeTokenRefreshErrorForStorage(json.error, res.status);
    await db
      .update(agentPluginCredentials)
      .set({
        lastError: code,
        updatedAt: new Date(),
      })
      .where(eq(agentPluginCredentials.id, row.id));
    return null;
  }

  const accessEnc = encryptToken(json.access_token);
  const expSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const newExpires = new Date(now + expSec * 1000);

  await db
    .update(agentPluginCredentials)
    .set({
      accessTokenEnc: accessEnc,
      expiresAt: newExpires,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(agentPluginCredentials.id, row.id));

  return json.access_token;
}
