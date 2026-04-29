/**
 * Structured one-line JSON logs for unified generation (grep-friendly). No PII / raw notes.
 */

export function logUnifiedGenerationJson(payload: Record<string, unknown>): void {
  console.info(JSON.stringify(payload));
}
