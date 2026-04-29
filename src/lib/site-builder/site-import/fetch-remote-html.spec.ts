/** @jest-environment node */
import { fetchRemoteHtmlForImport } from "./fetch-remote-html";

describe("fetchRemoteHtmlForImport safety", () => {
  it("rejects localhost", async () => {
    const r = await fetchRemoteHtmlForImport("http://localhost:3000/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("blocked_host");
  });

  it("rejects invalid URL", async () => {
    const r = await fetchRemoteHtmlForImport("not-a-url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_url");
  });
});
