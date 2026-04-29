/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/revenue-os-api-access", () => ({ enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/revenue-os/client-hub-ownership", () => ({
  assertValidClientId: jest.fn(),
  getOwnedClientRow: jest.fn(),
}));
jest.mock("@/lib/client-portal/portal-requests", () => ({ listOperatorRequests: jest.fn() }));

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { listOperatorRequests } from "@/lib/client-portal/portal-requests";

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let GET: typeof import("./route").GET;
beforeAll(async () => {
  ({ GET } = await import("./route"));
});

describe("GET /api/revenue-os/clients/[clientId]/requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
  });

  it("operator sees owned client requests", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue({ id: CID, ownerUserId: 9 } as never);
    jest.mocked(listOperatorRequests).mockResolvedValue([{ id: "r1" }] as never);
    const res = await GET(
      new NextRequest(`http://localhost/api/revenue-os/clients/${CID}/requests`),
      { params: Promise.resolve({ clientId: CID }) },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { items: Array<{ id: string }> };
    expect(j.items[0]?.id).toBe("r1");
  });

  it("operator cannot see unowned requests", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue(null);
    const res = await GET(
      new NextRequest(`http://localhost/api/revenue-os/clients/${CID}/requests`),
      { params: Promise.resolve({ clientId: CID }) },
    );
    expect(res.status).toBe(404);
  });
});
