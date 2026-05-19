/** Redact likely secrets from CRM intake notes before they leave the admin boundary. */

const REDACTED = "[redacted]";

const PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9_-]{8,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._~+/=-]{8,}\b/gi,
  /\b(?:api[_-]?key|apikey)\s*[:=]\s*\S+/gi,
  /\b(?:0x)?[a-fA-F0-9]{40}\b/g,
  /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
];

export function redactSensitiveIntakeText(text: string): string {
  let out = text;
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}
