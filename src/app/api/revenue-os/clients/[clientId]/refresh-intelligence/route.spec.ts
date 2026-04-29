/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/revenue-os-api-access", () => ({ enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/db/client-hub-ensure", () => ({ ensureClientHubTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/revenue-os/client-hub-ownership", () => ({
  assertValidClientId: jest.fn(),
  getOwnedClientRow: jest.fn(),
}));
jest.mock("@/lib/revenue-os/client-hub-rollup", () => ({ getClientHubRollupForOwnedClient: jest.fn() }));
jest.mock("@/lib/site-builder/intelligence/client-hub-rollup-sync", () => ({
  syncClientHubRollupToSiteIntelligence: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ getDb: jest.fn().mockResolvedValue({}) }));

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import { syncClientHubRollupToSiteIntelligence } from "@/lib/site-builder/intelligence/client-hub-rollup-sync";

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/revenue-os/clients/[clientId]/refresh-intelligence", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(7);
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getOwnedClientRow).mockReset();
    jest.mocked(getClientHubRollupForOwnedClient).mockReset();
    jest.mocked(syncClientHubRollupToSiteIntelligence).mockReset();
  });

  it("enforces ownership", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/revenue-os/clients/11111111-1111-4111-8111-111111111111/refresh-intelligence", {
        method: "POST",
      }),
      { params: Promise.resolve({ clientId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(404);
    expect(getClientHubRollupForOwnedClient).not.toHaveBeenCalled();
  });

  it("returns sync counters", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue({ id: "c", ownerUserId: 7 } as never);
    jest.mocked(getClientHubRollupForOwnedClient).mockResolvedValue({
      leadsCaptured: 1,
      conversationsOpened: 2,
      openConversations: 0,
      bookings: 0,
      crmMessagesCount: 0,
      widgetMessagesCount: 3,
      messagesExchanged: 3,
      agentInteractions: 3,
      activeSites: 1,
      activeAgents: 1,
      campaignsLaunched: 0,
      publishedPosts: 0,
      websiteVisits: null,
      lastActivityAt: null,
      leadQualifiedCount: 0,
      followUpCount: 0,
      taskCreatedCount: 0,
      bookingScheduledCount: 4,
    });
    jest.mocked(syncClientHubRollupToSiteIntelligence).mockResolvedValue({ rowsMatched: 6, rowsChanged: 2 });
    const res = await POST(
      new NextRequest("http://localhost/api/revenue-os/clients/11111111-1111-4111-8111-111111111111/refresh-intelligence", {
        method: "POST",
      }),
      { params: Promise.resolve({ clientId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { success: boolean; rowsMatched: number; rowsChanged: number; syncedAt: string };
    expect(j.success).toBe(true);
    expect(j.rowsMatched).toBe(6);
    expect(j.rowsChanged).toBe(2);
    expect(j.syncedAt).toMatch(/T/);
  });
});
