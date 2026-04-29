import { buildMaaniaDemoMailBody, buildMaaniaMailtoUrl, MAANIA_DEFAULT_DEMO_MAIL_SUBJECT } from "@/lib/maania/maania-mailto";

describe("maania-mailto", () => {
  it("buildMaaniaDemoMailBody includes share URL and default closing", () => {
    const body = buildMaaniaDemoMailBody("https://example.com/demo/abc", "Alex Agent");
    expect(body).toContain("https://example.com/demo/abc");
    expect(body).toContain("Alex Agent");
    expect(body).toContain("personalized demo");
  });

  it("buildMaaniaMailtoUrl encodes subject and body", () => {
    const url = buildMaaniaMailtoUrl({
      recipientEmail: "client@example.com",
      shareUrl: "https://example.com/demo/x",
      agentName: "Pat",
    });
    expect(url.startsWith("mailto:")).toBe(true);
    expect(url).toContain(encodeURIComponent(MAANIA_DEFAULT_DEMO_MAIL_SUBJECT));
    expect(url).toContain(encodeURIComponent("https://example.com/demo/x"));
  });
});
