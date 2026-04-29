import { resolveClientIdForCampaignOrReject } from "@/lib/revenue-os/validate-campaign-client-id";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";

jest.mock("@/lib/revenue-os/client-hub-queries", () => ({
  getOwnedClientRow: jest.fn(),
  assertValidClientId: (id: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("bad");
  },
}));

describe("resolveClientIdForCampaignOrReject", () => {
  beforeEach(() => {
    jest.mocked(getOwnedClientRow).mockReset();
  });

  it("allows empty string (legacy / unattributed)", async () => {
    const r = await resolveClientIdForCampaignOrReject(1, "");
    expect("clientId" in r && r.clientId).toBe("");
  });

  it("rejects invalid uuid", async () => {
    const r = await resolveClientIdForCampaignOrReject(1, "not-uuid");
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.status).toBe(400);
  });

  it("rejects when client is not owned", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue(null);
    const r = await resolveClientIdForCampaignOrReject(1, "11111111-1111-1111-1111-111111111111");
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.status).toBe(403);
  });

  it("returns id when owned", async () => {
    jest.mocked(getOwnedClientRow).mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111" } as never);
    const r = await resolveClientIdForCampaignOrReject(1, "11111111-1111-1111-1111-111111111111");
    expect("clientId" in r && r.clientId).toBe("11111111-1111-1111-1111-111111111111");
  });
});
