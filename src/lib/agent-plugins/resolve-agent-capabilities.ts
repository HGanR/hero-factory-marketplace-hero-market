import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentPluginCredentials, agentPluginInstallations } from "@/lib/db/schema";
import type {
  ResolvedAgentCapabilities,
  ExecutableActionInfo,
  ExecutionGatingSnapshot,
} from "@/lib/agent-plugins/types";
import { AGENT_PLUGIN_REGISTRY } from "@/lib/agent-plugins/registry";
import { getValidGoogleAccessTokenForAgent } from "@/lib/agent-plugins/google-token";

const PROVIDER_GOOGLE = "google";

function parseScopesJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function scopesCover(required: string[], granted: string[]): boolean {
  const g = new Set(granted);
  return required.every((s) => g.has(s));
}

function buildGating(params: {
  cred: { refreshTokenEnc: string | null } | null;
  grantedScopes: string[];
  token: string | null;
  lastError: string | null;
}): ExecutionGatingSnapshot {
  const hasCredential = params.cred != null;
  const hasRefreshToken = Boolean(params.cred?.refreshTokenEnc?.trim());
  const grantedScopeCount = params.grantedScopes.length;
  const accessTokenValid = Boolean(params.token);
  const reconnectSuggested =
    (!!params.lastError && params.lastError.length > 0) ||
    (hasRefreshToken && !params.token) ||
    (hasCredential && grantedScopeCount === 0);

  return {
    hasCredential,
    hasRefreshToken,
    grantedScopeCount,
    accessTokenValid,
    reconnectSuggested,
  };
}

/**
 * Returns executable actions only: enabled plugin + valid Google token + required scopes.
 * Uses the same credential row (`agentId` + `google`) as execution — never cross-agent.
 */
export async function resolveAgentCapabilities(agentId: string): Promise<ResolvedAgentCapabilities> {
  await ensureAgentTables();
  const db = await getDb();

  const [cred] = await db
    .select()
    .from(agentPluginCredentials)
    .where(and(eq(agentPluginCredentials.agentId, agentId), eq(agentPluginCredentials.provider, PROVIDER_GOOGLE)))
    .limit(1);

  const grantedScopes = parseScopesJson(cred?.scopesJson ?? null);
  const lastError = cred?.lastError ?? null;

  const token = await getValidGoogleAccessTokenForAgent(agentId);
  const providerAuthorized = Boolean(token && grantedScopes.length > 0);

  const gating = buildGating({ cred: cred ?? null, grantedScopes, token, lastError });

  const instRows = await db
    .select({ pluginKey: agentPluginInstallations.pluginKey, enabled: agentPluginInstallations.enabled })
    .from(agentPluginInstallations)
    .where(eq(agentPluginInstallations.agentId, agentId));

  const enabled = new Set(instRows.filter((r) => r.enabled).map((r) => r.pluginKey));

  const executableActions: ExecutableActionInfo[] = [];

  if (providerAuthorized) {
    for (const plugin of AGENT_PLUGIN_REGISTRY) {
      if (!enabled.has(plugin.pluginKey)) continue;
      if (!plugin.runtimeImplemented) continue;

      for (const action of plugin.actions) {
        if (!action.runtimeImplemented) continue;
        if (!scopesCover(action.requiredScopes, grantedScopes)) continue;
        executableActions.push({
          actionKey: action.actionKey,
          pluginKey: plugin.pluginKey,
          displayName: action.displayName,
          description: action.description,
          kind: action.kind,
          invocationHint: action.invocationHint,
        });
      }
    }
  }

  return {
    agentId,
    providerAuthorized,
    grantedScopes,
    executableActions,
    lastError,
    gating,
  };
}
