/**
 * Normalized categories for audit rows and monitoring (prefix `AUDIT_` in storage optional).
 */

export const AuditErrorCategory = {
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  DUPLICATE_TOOL_CALL: "DUPLICATE_TOOL_CALL",
  DUPLICATE_CALENDAR_EVENT: "DUPLICATE_CALENDAR_EVENT",
  CALENDAR_VALIDATION: "CALENDAR_VALIDATION",
  GMAIL_VALIDATION: "GMAIL_VALIDATION",
  /** Pass-through from executeAgentAction */
  EXECUTE: "EXECUTE",
} as const;

export type AuditErrorCategory = (typeof AuditErrorCategory)[keyof typeof AuditErrorCategory];

/** Map execute / runtime codes to stable audit category. */
export function normalizeAuditCategory(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c.startsWith("AUDIT_")) return code;
  if (
    c === "UNKNOWN_TOOL" ||
    c === "DUPLICATE_TOOL_CALL" ||
    c === "DUPLICATE_CALENDAR_EVENT" ||
    c === "CALENDAR_VALIDATION" ||
    c === "GMAIL_VALIDATION"
  ) {
    return c;
  }
  /** ExecuteAgentActionErrorCode and similar — stable EXECUTE_* prefix for dashboards */
  return `EXECUTE_${c}`;
}
