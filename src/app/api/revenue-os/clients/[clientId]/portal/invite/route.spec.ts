/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/revenue-os-api-access", () => ({ enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/revenue-os/client-hub-ownership", () => ({
  assertValidClientId: jest.fn(),
  getOwnedClientRow: jest.fn(),
}));
jest.mock("@/lib/db/client-portal-ensure", () => ({ ensureClientPortalTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/client-portal/portal-activity", () => ({ logClientPortalActivity: jest.fn().mockResolvedValue(undefined) }));

let insertedInvite: Record<string, unknown> | null = null;

jest.mock("@/lib/db", () => ({
  getDb: jest.fn().mockResolvedValue({
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertedInvite = v;
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  }),
}));

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let POST: typeof import("./route").POST;
beforeEach(async () => {
  jest.clearAllMocks();
  insertedInvite = null;
  ({ POST } = await import("./route"));
});

describe("POST /api/revenue-os/clients/[clientId]/portal/invite", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getOwnedClientRow).mockResolvedValue({ id: CID, ownerUserId: 9 } as never);
  });

  it("returns 404 when client not owned", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/revenue-os/clients/" + CID + "/portal/invite", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.co", role: "viewer" }),
      }),
      { params: Promise.resolve({ clientId: CID }) },
    );
    expect(res.status).toBe(404);
  });

  it("stores sha256 token hash and returns invite link with raw token once", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/revenue-os/clients/" + CID + "/portal/invite", {
        method: "POST",
        body: JSON.stringify({ email: "Client@Example.com", role: "viewer" }),
      }),
      { params: Promise.resolve({ clientId: CID }) },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { inviteLink?: string };
    expect(j.inviteLink).toMatch(/\/client-portal\/invite\//);
    expect(insertedInvite?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(insertedInvite?.email).toBe("client@example.com");
    const url = new URL(j.inviteLink!.replace(/^https?:\/\/[^/]+/, "http://x"));
    const raw = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const { hashInviteToken } = await import("@/lib/client-portal/invite-token");
    expect(hashInviteToken(raw)).toBe(insertedInvite?.tokenHash);
  });
});
