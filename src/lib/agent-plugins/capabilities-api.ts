/**
 * HTTP/API shapes for agent Google capabilities — keep aligned with GET /api/app/agents/[id]/capabilities.
 */
import type { ExecuteAgentActionErrorCode } from "@/lib/agent-plugins/execute-agent-action";
import type { ExecutionGatingSnapshot } from "@/lib/agent-plugins/types";
import type { LlmToolDefinition } from "@/lib/agent-plugins/tool-metadata";

export type CapabilityPluginActionRow = {
  actionKey: string;
  displayName: string;
  description: string;
  kind: "read" | "write";
  invocationHint: string;
  runtimeImplemented: boolean;
  executable: boolean;
};

export type CapabilityPluginRow = {
  pluginKey: string;
  displayName: string;
  purpose: string;
  authType: string;
  runtimeImplemented: boolean;
  enabled: boolean;
  actions: CapabilityPluginActionRow[];
};

/** Successful GET /api/app/agents/[id]/capabilities */
export type AgentCapabilitiesGetResponse = {
  providerAuthorized: boolean;
  grantedScopes: string[];
  lastError: string | null;
  lastErrorHint: string | null;
  gating: ExecutionGatingSnapshot;
  tools: LlmToolDefinition[];
  plugins: CapabilityPluginRow[];
};

/** Error body from POST /api/app/agents/[id]/capabilities/execute */
export type AgentCapabilitiesExecuteErrorBody = {
  error: string;
  code: ExecuteAgentActionErrorCode;
};
