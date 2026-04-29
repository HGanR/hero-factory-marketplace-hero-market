/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { evaluateRevenueOsSession } from "./revenue-os-session";
import { verifyToken } from "./auth";
import { getDb } from "./db";

jest.mock("./auth", () => ({
  verifyToken: jest.fn(),
  normalizeJwtUserId: jest.requireActual<typeof import("./auth")>("./auth").normalizeJwtUserId,
}));
jest.mock("./db");

function mockDbRevenueRow(revenueOsAccess: boolean | undefined) {
  const limit = jest.fn(async () =>
    revenueOsAccess === undefined ? [] : [{ revenueOsAccess }]
  );
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
}

describe("evaluateRevenueOsSession", () => {
  beforeEach(() => {
    jest.mocked(verifyToken).mockReset();
    (getDb as jest.Mock).mockReset();
  });

  it("allows when admin-token verifies as admin (no DB)", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "adm" ? { isAdmin: true, userId: 1 } : null
    );
    const v = await evaluateRevenueOsSession((n) => (n === "admin-token" ? "adm" : undefined));
    expect(v).toBe("allow");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("allows when auth-token verifies as admin", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "usr" ? { isAdmin: true, userId: 2 } : null
    );
    const v = await evaluateRevenueOsSession((n) => (n === "auth-token" ? "usr" : undefined));
    expect(v).toBe("allow");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns no_session without tokens", async () => {
    jest.mocked(verifyToken).mockReturnValue(null);
    const v = await evaluateRevenueOsSession(() => undefined);
    expect(v).toBe("no_session");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("allows marketplace user when revenueOsAccess is true", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "usr" ? { userId: 9 } : null
    );
    mockDbRevenueRow(true);
    const v = await evaluateRevenueOsSession((n) => (n === "auth-token" ? "usr" : undefined));
    expect(v).toBe("allow");
  });

  it("denies marketplace user when revenueOsAccess is false", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "usr" ? { userId: 9 } : null
    );
    mockDbRevenueRow(false);
    const v = await evaluateRevenueOsSession((n) => (n === "auth-token" ? "usr" : undefined));
    expect(v).toBe("deny");
  });

  it("denies when user row is missing", async () => {
    jest.mocked(verifyToken).mockImplementation((tok: string) =>
      tok === "usr" ? { userId: 999 } : null
    );
    mockDbRevenueRow(undefined);
    const v = await evaluateRevenueOsSession((n) => (n === "auth-token" ? "usr" : undefined));
    expect(v).toBe("deny");
  });
});
