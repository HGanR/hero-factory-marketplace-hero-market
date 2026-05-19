/**
 * Redact secrets from briefing JSON before persistence or API responses (pure).
 */

import { redactSecretsFromExecutivePrompt } from "@/lib/executive-agent/executive-agent-prompt-redact";

const SENSITIVE_KEY = /(apikey|api_key|secret|password|token|authorization|private[_-]?key)/i;

export function redactExecutiveBriefingJsonValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSecretsFromExecutivePrompt(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactExecutiveBriefingJsonValue(v)) as T;
  }
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactExecutiveBriefingJsonValue(v);
      }
    }
    return out as T;
  }
  return value;
}
