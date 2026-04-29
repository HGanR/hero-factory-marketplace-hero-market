import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/db/client-hub-ensure", () => ({ ensureClientHubTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/db/client-portal-ensure", () => ({ ensureClientPortalTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/db/agents-ensure", () => ({ ensureAgentTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/revenue-os/client-hub-ownership", () => ({ getOwnedClientRow: jest.fn().mockResolvedValue(null) }));

describe("getClientCommandCenterPayload access", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("returns null for unowned client", async () => {
    const mod = await import("@/lib/revenue-os/client-command-center-data");
    const res = await mod.getClientCommandCenterPayload(9, "11111111-1111-4111-8111-111111111111");
    expect(res).toBeNull();
  });
});
