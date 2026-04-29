import { normalizeAuditCategory } from "@/lib/agent-plugins/audit-codes";

describe("normalizeAuditCategory", () => {
  it("passes through known runtime categories", () => {
    expect(normalizeAuditCategory("DUPLICATE_TOOL_CALL")).toBe("DUPLICATE_TOOL_CALL");
    expect(normalizeAuditCategory("UNKNOWN_TOOL")).toBe("UNKNOWN_TOOL");
  });

  it("prefixes execute error codes", () => {
    expect(normalizeAuditCategory("CONFIRMATION_REQUIRED")).toBe("EXECUTE_CONFIRMATION_REQUIRED");
    expect(normalizeAuditCategory("NOT_EXECUTABLE")).toBe("EXECUTE_NOT_EXECUTABLE");
    expect(normalizeAuditCategory("FORBIDDEN")).toBe("EXECUTE_FORBIDDEN");
  });
});
