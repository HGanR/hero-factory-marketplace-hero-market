/**
 * Coerce MySQL tinyint / driver quirks into a real boolean for auth and API checks.
 */
export function mysqlTruthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return Boolean(value);
}
