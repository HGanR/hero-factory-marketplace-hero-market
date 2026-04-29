/**
 * Map Google API / OAuth token responses to runtime-safe strings (no stack traces, minimal PII).
 */

const GENERIC = "Google returned an error. Try again or re-authorize this agent.";

export type GoogleErrorShape = {
  error?: string | { message?: string; code?: number; errors?: Array<{ message?: string }> };
  error_description?: string;
};

/**
 * Extract a short, user-safe message from Google JSON bodies (Gmail, Calendar, Drive, OAuth token).
 */
export function safeGoogleErrorMessage(json: unknown, status: number, fallback = GENERIC): string {
  if (!json || typeof json !== "object") {
    return status === 401 || status === 403
      ? "Google denied access. Re-authorize this agent."
      : fallback;
  }

  const o = json as GoogleErrorShape;

  if (typeof o.error === "string") {
    if (o.error === "invalid_grant") {
      return "Google authorization expired or was revoked. Re-authorize this agent.";
    }
    if (o.error === "insufficientPermissions" || o.error === "accessNotConfigured") {
      return "This action needs additional Google permissions. Re-authorize this agent.";
    }
  }

  if (o.error && typeof o.error === "object") {
    const msg = o.error.message?.trim();
    if (msg) {
      if (/invalid/i.test(msg) && /credential/i.test(msg)) {
        return "Google credentials are no longer valid. Re-authorize this agent.";
      }
      return truncateSafe(msg, 240);
    }
    const first = o.error.errors?.[0]?.message?.trim();
    if (first) return truncateSafe(first, 240);
  }

  if (typeof o.error_description === "string" && o.error_description.trim()) {
    return truncateSafe(o.error_description.trim(), 240);
  }

  if (status === 401 || status === 403) {
    return "Google denied access. Re-authorize this agent.";
  }

  return fallback;
}

function truncateSafe(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Value safe to persist on agent_plugin_credentials.lastError (short, no secrets). */
export function sanitizeTokenRefreshErrorForStorage(googleError: string | undefined, httpStatus: number): string {
  if (!googleError) return `token_refresh_http_${httpStatus}`;
  if (googleError === "invalid_grant") return "reauthorize_required";
  if (googleError === "invalid_client") return "oauth_client_misconfigured";
  return `token_refresh_${googleError.replace(/[^a-z0-9_]/gi, "_").slice(0, 64)}`;
}

/** UI / API: map stored codes to a safe sentence (never raw provider text). */
export function humanizeStoredCredentialError(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  if (code === "reauthorize_required") return "Google authorization expired or was revoked. Re-authorize this agent.";
  if (code === "oauth_client_misconfigured") return "OAuth client configuration is invalid.";
  if (code.startsWith("token_refresh_")) return "Google access could not be refreshed. Re-authorize this agent.";
  return "Google authorization needs attention. Re-authorize this agent.";
}
