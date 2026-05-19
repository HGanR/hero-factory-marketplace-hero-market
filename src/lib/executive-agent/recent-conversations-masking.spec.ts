import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskSnippet, maskUserIdLabel, maskVisitorLabel } from "@/lib/executive-agent/executive-admin-masking";

describe("executive admin masking (recent conversations surface)", () => {
  it("redacts email-like substrings in snippets", () => {
    const s = maskSnippet("Please email ops@example.com today");
    assert.ok(!s.includes("ops@"));
    assert.ok(s.includes("[redacted]"));
  });

  it("never exposes full visitor ids", () => {
    assert.equal(maskVisitorLabel("abc12345"), "Visitor …2345");
  });

  it("coarsens user ids to non-PII labels", () => {
    assert.equal(maskUserIdLabel(42), "User #42");
  });
});
