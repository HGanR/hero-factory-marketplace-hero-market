/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/meet/broadcast-host", () => ({ assertMeetBroadcastHost: jest.fn() }));
jest.mock("@/lib/meet/broadcast-show-package-store", () => ({
  listBroadcastShowPackagesForUser: jest.fn(),
  createBroadcastShowPackage: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { listBroadcastShowPackagesForUser, createBroadcastShowPackage } from "@/lib/meet/broadcast-show-package-store";

describe("/api/meet/broadcast/show-packages", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GET 401 when anonymous", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/show-packages"));
    expect(res.status).toBe(401);
  });

  it("GET lists packages", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (listBroadcastShowPackagesForUser as jest.Mock).mockResolvedValueOnce([
      {
        id: 2,
        userId: 1,
        name: "Weekly",
        description: null,
        scenePresetId: null,
        timelineTemplateId: null,
        defaultBrandingJson: null,
        defaultOverlayPackId: null,
        defaultGuestCardPackId: null,
        defaultRoomId: null,
        isDefault: false,
        createdAtIso: "2026-01-01T00:00:00.000Z",
        updatedAtIso: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/show-packages?hostWallet=0xabc"));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { packages?: { id: number }[] };
    expect(j.packages?.[0]?.id).toBe(2);
  });

  it("POST creates package", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (createBroadcastShowPackage as jest.Mock).mockResolvedValueOnce({ ok: true, id: 5 });
    const req = new NextRequest("http://localhost/api/meet/broadcast/show-packages", {
      method: "POST",
      body: JSON.stringify({ name: "N1", hostWallet: "0xabc" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { id?: number };
    expect(j.id).toBe(5);
  });
});
