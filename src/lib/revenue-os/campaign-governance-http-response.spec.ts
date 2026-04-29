/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  GOVERNANCE_HTTP_ERROR,
  governanceBadRequestResponse,
  governanceForbiddenCampaignSettingsResponse,
  governanceInternalErrorResponse,
  governanceNotFoundResponse,
  governanceUnauthorizedResponse,
  governanceValidationErrorResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";

describe("campaign-governance-http-response", () => {
  it("exposes stable error code constants", () => {
    expect(GOVERNANCE_HTTP_ERROR.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(GOVERNANCE_HTTP_ERROR.NOT_FOUND).toBe("NOT_FOUND");
    expect(GOVERNANCE_HTTP_ERROR.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
  });

  it("returns 401 UNAUTHORIZED shape", async () => {
    const res = governanceUnauthorizedResponse();
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string; message: string };
    expect(j.error).toBe("UNAUTHORIZED");
    expect(j.message).toContain("Authentication");
  });

  it("returns 404 NOT_FOUND with default message", async () => {
    const res = governanceNotFoundResponse();
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("NOT_FOUND");
  });

  it("returns 400 NO_CHANGES when requested", async () => {
    const res = governanceBadRequestResponse("x", "NO_CHANGES");
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("NO_CHANGES");
  });

  it("returns 403 FORBIDDEN_CAMPAIGN_SETTINGS", async () => {
    const res = governanceForbiddenCampaignSettingsResponse();
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("FORBIDDEN_CAMPAIGN_SETTINGS");
  });

  it("returns 400 VALIDATION_ERROR with details", async () => {
    const res = governanceValidationErrorResponse("bad", { a: 1 });
    const j = (await res.json()) as { error: string; details: unknown };
    expect(j.error).toBe("VALIDATION_ERROR");
    expect(j.details).toEqual({ a: 1 });
  });

  it("returns 500 INTERNAL_ERROR", async () => {
    const res = governanceInternalErrorResponse();
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("INTERNAL_ERROR");
  });
});
