import "server-only";

/** Split free-text "usual records" hints into checklist-style strings for storage. */
export function parseRequiredRecordsFromUsualRecords(usualRecords: string): string[] {
  return usualRecords
    .split(/[,;\n]/)
    .map((s) => s.replace(/^[\s*\-•]+/u, "").trim())
    .filter((s) => s.length > 0);
}

/**
 * Optional post-insert enrichment for tax form candidates (scoring, dedupe).
 * Safe no-op until extended logic is enabled.
 */
export async function enrichFormCandidatesForProfile(_accountingProfileId: number): Promise<void> {}
