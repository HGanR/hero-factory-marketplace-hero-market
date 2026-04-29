/** Normalize user input (comma list or JSON array) to JSON string array for linkedFormCodesJson. */
export function normalizeLinkedFormCodesJson(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("[")) {
    try {
      JSON.parse(t);
      return t.slice(0, 2000);
    } catch {
      return null;
    }
  }
  const codes = t
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(codes);
}
