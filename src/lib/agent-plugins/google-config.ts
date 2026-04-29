/**
 * Google OAuth for agent-executable tools (separate env vars from any other Google app).
 */
const BASE =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export function getGoogleAgentRedirectUri(): string {
  return `${BASE.replace(/\/$/, "")}/api/agent-plugins/oauth/google/callback`;
}

export function getGoogleAgentClientId(): string | null {
  return process.env.GOOGLE_AGENT_CLIENT_ID?.trim() || null;
}

export function getGoogleAgentClientSecret(): string | null {
  return process.env.GOOGLE_AGENT_CLIENT_SECRET?.trim() || null;
}

export function isGoogleAgentOAuthConfigured(): boolean {
  return Boolean(getGoogleAgentClientId() && getGoogleAgentClientSecret());
}
