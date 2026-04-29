/**
 * @jest-environment node
 */
jest.mock("@/lib/client-portal/portal-session", () => ({
  requireClientPortalSession: jest.fn(),
}));
jest.mock("@/lib/client-portal/portal-requests", () => ({
  createClientPortalRequest: jest.fn(),
  listClientPortalRequests: jest.fn(),
}));

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { requireClientPortalSession } from "@/lib/client-portal/portal-session";
import { createClientPortalRequest } from "@/lib/client-portal/portal-requests";

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/client-portal/requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireClientPortalSession).mockResolvedValue({
      tokenPayload: { clientId: "c1", ownerUserId: 9, portalUserId: "p1", role: "manager" },
      client: { id: "c1", ownerUserId: 9, name: "Client", workspaceId: null, status: "active", notes: null, createdAt: null, updatedAt: null },
      portalUser: { id: "p1" },
    } as never);
    jest.mocked(createClientPortalRequest).mockResolvedValue("r1");
  });

  it("portal user creates request", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/client-portal/requests", {
        method: "POST",
        body: JSON.stringify({ type: "ai_issue", title: "Bad answer", description: "Details" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(createClientPortalRequest).toHaveBeenCalled();
  });

  it("portal cannot create for another client", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/client-portal/requests", {
        method: "POST",
        body: JSON.stringify({ clientId: "other", type: "other", title: "X", description: "Y" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
