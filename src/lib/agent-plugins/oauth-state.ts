/**
 * Signed OAuth state for agent plugin flows (not social posting).
 */
import jwt from "jsonwebtoken";

const SECRET =
  process.env.AGENT_PLUGIN_OAUTH_STATE_SECRET || process.env.JWT_SECRET || "fallback-secret";

export type AgentPluginOAuthStatePayload = {
  userId: string;
  agentId: string;
  returnTo?: string;
};

export function createAgentPluginOAuthState(payload: AgentPluginOAuthStatePayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "10m" });
}

export function verifyAgentPluginOAuthState(token: string): AgentPluginOAuthStatePayload | null {
  try {
    return jwt.verify(token, SECRET) as AgentPluginOAuthStatePayload;
  } catch {
    return null;
  }
}
