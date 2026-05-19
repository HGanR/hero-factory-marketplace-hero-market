/**
 * Strip likely secrets from text before it is sent to an LLM (pure — safe in tests).
 */

const SK_OPENAI = /\bsk-[a-zA-Z0-9_-]{10,}\b/g;
const BEARER = /\bBearer\s+[a-zA-Z0-9._\-+/=]{8,}\b/gi;
const BASIC = /\bBasic\s+[a-zA-Z0-9+/=]{8,}\b/gi;
const ASSIGN_SECRET = /\b(api[_-]?key|secret|password|token|authorization)\s*[:=]\s*["']?[^\s"',]{4,}["']?/gi;

export function redactSecretsFromExecutivePrompt(text: string): string {
  return text
    .replace(SK_OPENAI, "[REDACTED_TOKEN]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(BASIC, "Basic [REDACTED]")
    .replace(ASSIGN_SECRET, (m) => m.replace(/[:=]\s*["']?[^\s"',]+["']?/i, "=[REDACTED]"));
}
