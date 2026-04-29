import { NextRequest } from "next/server";
import { GET } from "./route";
import { getMeetAvatarNfts } from "@/lib/meet/avatar-nfts/get-avatar-nfts";

jest.mock("@/lib/meet/avatar-nfts/get-avatar-nfts", () => ({
  getMeetAvatarNfts: jest.fn(),
}));

const mockGet = getMeetAvatarNfts as jest.MockedFunction<typeof getMeetAvatarNfts>;

function req(url: string) {
  return new NextRequest(new URL(url, "http://localhost"));
}

describe("GET /api/meet/avatar-nfts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when walletAddress missing", async () => {
    const res = await GET(req("http://localhost/api/meet/avatar-nfts?walletType=evm"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when walletType invalid", async () => {
    const res = await GET(
      req("http://localhost/api/meet/avatar-nfts?walletAddress=0xabc&walletType=btc")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when evm address not 0x", async () => {
    const res = await GET(
      req("http://localhost/api/meet/avatar-nfts?walletAddress=abc&walletType=evm")
    );
    expect(res.status).toBe(400);
  });

  it("returns JSON from getMeetAvatarNfts", async () => {
    mockGet.mockResolvedValue({
      items: [],
      warnings: [],
      partialFailure: false,
      sourcesAttempted: [],
      sourcesSucceeded: [],
      solanaAvatarUnsupported: false,
      truncated: false,
      limit: 20,
    });
    const res = await GET(
      req("http://localhost/api/meet/avatar-nfts?walletAddress=0xabc&walletType=evm")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(20);
    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: "0xabc",
        walletType: "evm",
        limit: 20,
      })
    );
  });

  it("parses includeHero=false", async () => {
    mockGet.mockResolvedValue({
      items: [],
      warnings: [],
      partialFailure: false,
      sourcesAttempted: [],
      sourcesSucceeded: [],
      solanaAvatarUnsupported: false,
      truncated: false,
      limit: 20,
    });
    await GET(
      req(
        "http://localhost/api/meet/avatar-nfts?walletAddress=0xabc&walletType=evm&includeHero=false"
      )
    );
    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({
        includeHero: false,
        includeMarketplace: true,
      })
    );
  });
});
