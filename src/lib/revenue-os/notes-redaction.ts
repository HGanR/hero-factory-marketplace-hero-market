/**
 * Redacts potentially sensitive data from notes before sending to LLM.
 * Reduces risk of accidental secrets leakage.
 * Conservative to limit false positives; high-risk patterns prioritized.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
// Common API key patterns (sk-..., xoxb-..., ghp_..., etc.)
const API_KEY_RE = /\b(?:sk|pk|xoxb|xoxp|ghp|gho|api[_-]?key)[-_]?[a-zA-Z0-9]{20,}\b/gi;
// AWS access key: AKIA + 16 alphanumeric
const AWS_ACCESS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/g;
// 64-char hex (private keys, hashes) — optional 0x prefix
const HEX_64_RE = /\b(?:0x)?[a-fA-F0-9]{64}\b/g;
// Long base64 blobs (>80 chars) — common in JWTs, credentials
const BASE64_LONG_RE = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g;
// Mnemonic: 12+ consecutive short words (3–8 chars) — conservative, may miss some
const MNEMONIC_RE = /\b(?:\w{3,8}\s+){11,23}(?:\w{3,8})\b/g;

const REDACT_EMAIL = "[email redacted]";
const REDACT_PHONE = "[phone redacted]";
const REDACT_SECRET = "[redacted]";

export function redactNotes(notes: string): string {
  if (!notes || typeof notes !== "string") return "";
  let out = notes;

  out = out.replace(EMAIL_RE, REDACT_EMAIL);
  out = out.replace(PHONE_RE, REDACT_PHONE);
  out = out.replace(API_KEY_RE, REDACT_SECRET);
  out = out.replace(AWS_ACCESS_KEY_RE, REDACT_SECRET);
  out = out.replace(HEX_64_RE, REDACT_SECRET);
  out = out.replace(BASE64_LONG_RE, REDACT_SECRET);
  out = out.replace(MNEMONIC_RE, "[mnemonic redacted]");

  return out;
}
