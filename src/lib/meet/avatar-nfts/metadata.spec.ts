import { substituteErc1155Uri, normalizeIpfsToHttp } from "./metadata";

describe("substituteErc1155Uri", () => {
  it("substitutes id placeholder", () => {
    expect(substituteErc1155Uri("https://x/{id}.json", 10n)).toBe("https://x/a.json");
  });
});

describe("normalizeIpfsToHttp", () => {
  it("rewrites ipfs://", () => {
    expect(normalizeIpfsToHttp("ipfs://QmX")).toContain("gateway.pinata.cloud");
  });
});
