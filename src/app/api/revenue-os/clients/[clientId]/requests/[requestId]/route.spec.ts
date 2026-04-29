/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/revenue-os-api-access", () => ({ enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/revenue-os/client-hub-ownership", () => ({
  assertValidClientId: jest.fn(),
  getOwnedClientRow: jest.fn(),
}));
jest.mock("@/lib/client-portal/portal-requests", () => ({ updateOperatorRequestStatus: jest.fn() }));

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { updateOperatorRequestStatus } from "@/lib/client-portal/portal-requests";

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let PATCH: typeof import("./route").PATCH;
beforeAll(async () => {
  ({ PATCH } = await import("./route"));
});

describe("PATCH /api/revenue-os/clients/[clientId]/requests/[requestId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getOwnedClientRow).mockResolvedValue({ id: CID, ownerUserId: 9 } as never);
  });

  it("status update works", async () => {
    jest.mocked(updateOperatorRequestStatus).mockResolvedValue({ id: "r1", status: "reviewing" } as never);
    const res = await PATCH(
      new NextRequest(`http://localhost/api/revenue-os/clients/${CID}/requests/r1`, {
        method: "PATCH",
        body: JSON.stringify({ status: "reviewing", operatorNote: "checking" }),
      }),
      { params: Promise.resolve({ clientId: CID, requestId: "r1" }) },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { item: { status: string } };
    expect(j.item.status).toBe("reviewing");
  });
});
