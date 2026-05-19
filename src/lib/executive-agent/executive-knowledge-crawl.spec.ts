import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateExecutiveKnowledgeCrawlUrl } from "@/lib/executive-agent/executive-knowledge-crawl";

describe("executive-knowledge-crawl url policy", () => {
  it("accepts public https hosts", () => {
    const u = validateExecutiveKnowledgeCrawlUrl("https://example.com/docs");
    assert.equal(u.hostname, "example.com");
  });

  it("rejects localhost", () => {
    assert.throws(() => validateExecutiveKnowledgeCrawlUrl("http://localhost:3000/"), /PRIVATE_OR_LOCAL_HOST/);
  });

  it("rejects private IPv4", () => {
    assert.throws(() => validateExecutiveKnowledgeCrawlUrl("http://192.168.0.10/"), /PRIVATE_OR_LOCAL_HOST/);
  });

  it("rejects non-http schemes", () => {
    assert.throws(() => validateExecutiveKnowledgeCrawlUrl("file:///etc/passwd"), /INVALID_URL_SCHEME/);
  });

  it("rejects URLs with embedded credentials", () => {
    assert.throws(() => validateExecutiveKnowledgeCrawlUrl("https://user:pass@example.com/"), /CREDENTIALS_NOT_ALLOWED/);
  });
});
