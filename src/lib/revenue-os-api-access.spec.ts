/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import {
  enforceRevenueOsApiAccess,
  REVENUE_OS_ACCESS_DENIED_ERROR,
  REVENUE_OS_ACCESS_DENIED_MESSAGE,
} from "./revenue-os-api-access";
import * as sessionMod from "./revenue-os-session";

jest.mock("./revenue-os-session");

describe("enforceRevenueOsApiAccess", () => {
  beforeEach(() => {
    jest.mocked(sessionMod.evaluateRevenueOsSession).mockReset();
  });

  it("returns null when session is allow (with NextRequest)", async () => {
    jest.mocked(sessionMod.evaluateRevenueOsSession).mockResolvedValue("allow");
    const req = new NextRequest("http://localhost/api/revenue-os/x");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).toBeNull();
  });

  it("returns null when session is no_session", async () => {
    jest.mocked(sessionMod.evaluateRevenueOsSession).mockResolvedValue("no_session");
    const req = new NextRequest("http://localhost/api/revenue-os/x");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).toBeNull();
  });

  it("returns 403 REVENUE_OS_ACCESS_DENIED when session is deny", async () => {
    jest.mocked(sessionMod.evaluateRevenueOsSession).mockResolvedValue("deny");
    const req = new NextRequest("http://localhost/api/revenue-os/x");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const j = (await res!.json()) as { error: string; message: string };
    expect(j.error).toBe(REVENUE_OS_ACCESS_DENIED_ERROR);
    expect(j.message).toBe(REVENUE_OS_ACCESS_DENIED_MESSAGE);
  });
});
