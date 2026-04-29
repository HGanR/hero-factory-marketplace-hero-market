/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe("GET /api/meet/broadcast/context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns masked identity and hostRule", async () => {
    mockUser.mockResolvedValueOnce(9);
    mockGetDb.mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([{ email: "ada@troo.test", walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }]),
          })),
        })),
      })),
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostRule?: string; identityEmailMasked?: string };
    expect(body.hostRule).toBe("wallet_must_match");
    expect(body.identityEmailMasked).toContain("***@");
  });
});
