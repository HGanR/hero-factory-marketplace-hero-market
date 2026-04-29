import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentPluginCredentials, agentPluginInstallations } from "@/lib/db/schema";
import { getActionDefinition } from "@/lib/agent-plugins/registry";
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

export type ExecutionBlocker =
  | "unknown_action"
  | "plugin_disabled"
  | "no_credential"
  | "no_refresh_token"
  | "no_granted_scopes"
  | "token_invalid"
  | "missing_scope"
  | "ready";

export type ExecutionGateExplanation = {
  blocker: ExecutionBlocker;
  /** Runtime-safe, user-presentable */
  message: string;
};

const M: Record<ExecutionBlocker, string> = {
  unknown_action: "Unknown action.",
  plugin_disabled: "Enable this capability for the agent first.",
  no_credential: "Authorize Google for this agent.",
  no_refresh_token: "Google authorization is incomplete. Re-authorize this agent.",
  no_granted_scopes: "Google authorization did not grant any scopes. Re-authorize this agent.",
  token_invalid: "Google access could not be refreshed. Re-authorize this agent.",
  missing_scope: "This action needs permissions that were not granted. Re-authorize this agent.",
  ready: "Ready.",
};

/**
 * Single source of truth for why an action may not run (mirrors resolve + execute checks).
 * Credentials are always loaded by `agentId` — cross-agent isolation is enforced at the DB query.
 */
export async function explainExecutionGate(agentId: string, actionKey: string): Promise<ExecutionGateExplanation> {
  const found = getActionDefinition(actionKey);
  if (!found) {
    return { blocker: "unknown_action", message: M.unknown_action };
  }

  await ensureAgentTables();
  const db = await getDb();

  const [inst] = await db
    .select({ enabled: agentPluginInstallations.enabled })
    .from(agentPluginInstallations)
    .where(
      and(
        eq(agentPluginInstallations.agentId, agentId),
        eq(agentPluginInstallations.pluginKey, found.plugin.pluginKey)
      )
    )
    .limit(1);

  if (!inst?.enabled) {
    return { blocker: "plugin_disabled", message: M.plugin_disabled };
  }

  const [cred] = await db
    .select()
    .from(agentPluginCredentials)
    .where(and(eq(agentPluginCredentials.agentId, agentId), eq(agentPluginCredentials.provider, PROVIDER_GOOGLE)))
    .limit(1);

  if (!cred) {
    return { blocker: "no_credential", message: M.no_credential };
  }

  if (!cred.refreshTokenEnc?.trim()) {
    return { blocker: "no_refresh_token", message: M.no_refresh_token };
  }

  const grantedScopes = parseScopesJson(cred.scopesJson ?? null);
  if (grantedScopes.length === 0) {
    return { blocker: "no_granted_scopes", message: M.no_granted_scopes };
  }

  const token = await getValidGoogleAccessTokenForAgent(agentId);
  if (!token) {
    return { blocker: "token_invalid", message: M.token_invalid };
  }

  if (!scopesCover(found.action.requiredScopes, grantedScopes)) {
    return { blocker: "missing_scope", message: M.missing_scope };
  }

  return { blocker: "ready", message: M.ready };
}
