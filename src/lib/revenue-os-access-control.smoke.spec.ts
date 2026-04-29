/**
 * High-level regression smoke for Revenue OS access control.
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { evaluateRevenueOsSession } from "./revenue-os-session";
import {
  enforceRevenueOsApiAccess,
  REVENUE_OS_ACCESS_DENIED_ERROR,
  REVENUE_OS_ACCESS_DENIED_MESSAGE,
} from "./revenue-os-api-access";
import { verifyToken } from "./auth";
import { getDb } from "./db";

jest.mock("./auth", () => ({
  verifyToken: jest.fn(),
  normalizeJwtUserId: jest.requireActual<typeof import("./auth")>("./auth").normalizeJwtUserId,
}));
jest.mock("./db");

function reqWithCookies(cookieHeader: string) {
  return new NextRequest("http://localhost/api/revenue-os/approval-audit-recent", {
    headers: { cookie: cookieHeader },
  });
}

function mockDbRevenueRow(revenueOsAccess: boolean | undefined) {
  const limit = jest.fn(async () =>
    revenueOsAccess === undefined ? [] : [{ revenueOsAccess }]
  );
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
}

describe("Revenue OS access control (smoke)", () => {
  beforeEach(() => {
    jest.mocked(verifyToken).mockReset();
    (getDb as jest.Mock).mockReset();
  });

  it("blocked marketplace user: protected API gate returns 403 REVENUE_OS_ACCESS_DENIED", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "userjwt" ? { userId: 42 } : null
    );
    mockDbRevenueRow(false);
    const req = reqWithCookies("auth-token=userjwt");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = (await res!.json()) as { error: string; message: string };
    expect(body.error).toBe(REVENUE_OS_ACCESS_DENIED_ERROR);
    expect(body.message).toBe(REVENUE_OS_ACCESS_DENIED_MESSAGE);
  });

  it("allowed marketplace user: API gate returns null (handler may proceed)", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "userjwt" ? { userId: 42 } : null
    );
    mockDbRevenueRow(true);
    const req = reqWithCookies("auth-token=userjwt");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).toBeNull();
  });

  it("admin session: bypass without revenueOsAccess DB lookup", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "adminjwt" ? { isAdmin: true, userId: 1 } : null
    );
    const req = reqWithCookies("admin-token=adminjwt");
    const res = await enforceRevenueOsApiAccess(req);
    expect(res).toBeNull();
    expect(getDb).not.toHaveBeenCalled();
    const v = await evaluateRevenueOsSession((n) => (n === "admin-token" ? "adminjwt" : undefined));
    expect(v).toBe("allow");
  });

  it("marketing /revenue-os landing stays public (no server ROS layout gate)", () => {
    const pagePath = join(process.cwd(), "src/app/revenue-os/page.tsx");
    const src = readFileSync(pagePath, "utf8");
    expect(src).not.toContain("assertMarketplaceRevenueOsAccess");
    expect(src).not.toContain("revenue-os-access-server");
  });
});
