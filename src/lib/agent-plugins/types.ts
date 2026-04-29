/**
 * Google agent capabilities — executable tools and OAuth state (`agent_plugin_credentials` per `agentId`).
 * Not a generic integration platform; scope stays Workspace tools only.
 */

export type AgentExecutionContext = {
  agentId: string;
  userId: number;
  accessToken: string;
};

export type AgentActionKind = "read" | "write";

export type AgentPluginActionDefinition = {
  /** Stable id, e.g. calendar.freeBusy */
  actionKey: string;
  /** Short label for UI + LLM */
  displayName: string;
  /** What the agent can do (user-facing) */
  description: string;
  /** Google OAuth scope required for this action */
  requiredScopes: string[];
  /** Implemented and callable server-side */
  runtimeImplemented: boolean;
  /** Read vs write — used for safety messaging and tool ordering */
  kind: AgentActionKind;
  /** When the LLM should choose this tool (short imperative) */
  invocationHint: string;
};

export type AgentPluginDefinition = {
  pluginKey: string;
  displayName: string;
  /** What the agent can do with this capability */
  purpose: string;
  authType: "oauth2";
  provider: "google";
  oauthProviderKey: "google";
  /** All scopes requested when authorizing Google for this agent */
  scopes: string[];
  actions: AgentPluginActionDefinition[];
  runtimeImplemented: boolean;
};

export type ExecutableActionInfo = {
  actionKey: string;
  pluginKey: string;
  displayName: string;
  description: string;
  kind: AgentActionKind;
  invocationHint: string;
};

export type ExecutionGatingSnapshot = {
  /** Row exists in agent_plugin_credentials for Google */
  hasCredential: boolean;
  hasRefreshToken: boolean;
  grantedScopeCount: number;
  accessTokenValid: boolean;
  /** User should open OAuth again (revoked/expired refresh or missing scopes on stored error) */
  reconnectSuggested: boolean;
};

export type ResolvedAgentCapabilities = {
  agentId: string;
  providerAuthorized: boolean;
  /** Scopes granted on the stored credential (if any) */
  grantedScopes: string[];
  /** Actions that are enabled + authorized + implemented */
  executableActions: ExecutableActionInfo[];
  /** Short machine-readable error from last token refresh, if any */
  lastError: string | null;
  /** Aligns resolver checks with execute path */
  gating: ExecutionGatingSnapshot;
};
