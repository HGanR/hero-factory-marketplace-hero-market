/**
 * Shared helpers for `skipper_prompt_overlays` DB errors (no server-only — safe for unit tests).
 */

export function isSkipperPromptOverlaysMissingTableError(e: unknown): boolean {
  if (e == null) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (!/skipper_prompt_overlays/i.test(msg)) return false;
  if (/1146|42S02|ER_NO_SUCH_TABLE|doesn't exist|does not exist|Unknown table/i.test(msg)) return true;
  const o = e as { code?: string; errno?: number };
  if (o.errno === 1146) return true;
  if (o.code === "ER_NO_SUCH_TABLE" || o.code === "42S02") return true;
  return false;
}
