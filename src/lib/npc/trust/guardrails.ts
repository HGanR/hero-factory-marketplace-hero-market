/**
 * Compliance-safe response guardrails for Jarva.
 * Blocks high-risk claims and enforces safe positioning language.
 */

/** Phrases the NPC must NEVER output (or similar variants). */
export const BANNED_CLAIMS = [
  "trust eliminates all taxes",
  "private trust is outside irs jurisdiction",
  "ecclesiastical trust makes you sovereign",
  "irrevocable trust guarantees creditor protection",
  "you don't need to file taxes",
  "trust is completely secret from the irs",
  "sovereign immunity",
  "outside the law",
  "immune from taxation",
  "no tax liability",
  "tax-free",
  "asset protection trust guarantees",
  "trust makes you sovereign",
  "no filing requirement",
];

/** Safe alternative phrases to suggest when dangerous concepts appear. */
export const SAFE_ALTERNATIVES: Record<string, string> = {
  "trust eliminates all taxes": "Trust tax treatment depends on structure; no trust eliminates all tax obligations.",
  "private trust is outside irs jurisdiction": "Private trusts remain subject to IRS jurisdiction and tax rules.",
  "ecclesiastical trust makes you sovereign": "Ecclesiastical status does not create sovereign immunity or tax exemption without 501(c)(3) qualification.",
  "irrevocable trust guarantees creditor protection": "Asset protection strength depends on timing, jurisdiction, and proper structuring.",
  "you don't need to file taxes": "Trusts may require filings (e.g., Form 1041); consult a tax professional.",
};

/**
 * Scans text for banned claims. Returns true if text appears safe.
 */
export function passesGuardrails(text: string): boolean {
  const lower = text.toLowerCase();
  for (const banned of BANNED_CLAIMS) {
    if (lower.includes(banned)) return false;
  }
  return true;
}

/**
 * Returns the first banned claim found, or null if safe.
 */
export function detectBannedClaim(text: string): string | null {
  const lower = text.toLowerCase();
  for (const banned of BANNED_CLAIMS) {
    if (lower.includes(banned)) return banned;
  }
  return null;
}

/**
 * Sanitizes LLM output by detecting banned claims and replacing with safe fallback.
 */
export function sanitizeResponse(text: string): string {
  const banned = detectBannedClaim(text);
  if (!banned) return text;

  const safe = SAFE_ALTERNATIVES[banned];
  if (safe) {
    return `${safe} Trusts are tools for legal structuring, not legal immunity. I encourage you to consult a licensed attorney or tax professional for your specific situation.`;
  }

  return `I cannot make that claim. Trusts are tools for legal structuring, not legal immunity. Tax treatment and asset protection depend on many factors. Please consult a licensed attorney or tax professional for your specific situation.`;
}
