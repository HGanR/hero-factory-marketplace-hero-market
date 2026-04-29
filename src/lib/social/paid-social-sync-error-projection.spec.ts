/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { projectPaidStructuredSyncError } from "@/lib/social/paid-social-sync-error-projection";

describe("projectPaidStructuredSyncError", () => {
  it("maps auth", () => {
    const p = projectPaidStructuredSyncError({ hadAuth: true });
    expect(p?.state).toBe("auth_blocked");
    expect(p?.retryWorthwhile).toBe("unlikely");
  });

  it("maps throttle", () => {
    const p = projectPaidStructuredSyncError({ hadThrottle: true });
    expect(p?.state).toBe("throttled");
    expect(p?.retryWorthwhile).toBe("later");
  });

  it("maps partial_data from partial flag", () => {
    const p = projectPaidStructuredSyncError({
      partial: true,
      errors: [{ phase: "campaign", message: "x" }],
    });
    expect(p?.state).toBe("partial_data");
  });

  it("maps transient from worstHardCategory", () => {
    const p = projectPaidStructuredSyncError({
      worstHardCategory: "transient_network",
      errors: [{ message: "timeout" }],
    });
    expect(p?.state).toBe("transient_failure");
  });

  it("maps not_found", () => {
    const p = projectPaidStructuredSyncError({
      worstHardCategory: "not_found",
      errors: [{ message: "nope" }],
    });
    expect(p?.state).toBe("not_found");
  });

  it("returns unknown for generic errors", () => {
    const p = projectPaidStructuredSyncError({
      errors: [{ message: "weird" }],
    });
    expect(p?.state).toBe("unknown");
  });

  it("returns null when nothing to show", () => {
    expect(projectPaidStructuredSyncError(null)).toBeNull();
    expect(projectPaidStructuredSyncError({})).toBeNull();
  });
});
