import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";

describe("redactSensitiveIntakeText", () => {
  it("redacts OpenAI-style keys", () => {
    const out = redactSensitiveIntakeText("Use sk-abcdefghijklmnopqrstuvwxyz1234567890 for API");
    assert.match(out, /\[redacted\]/);
    assert.doesNotMatch(out, /sk-abcdefghijklmnopqrstuvwxyz1234567890/);
  });

  it("redacts Bearer tokens", () => {
    const out = redactSensitiveIntakeText("Header: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
    assert.match(out, /\[redacted\]/);
    assert.doesNotMatch(out, /eyJhbGciOiJIUzI1NiJ9/);
  });

  it("redacts api key assignments", () => {
    const out = redactSensitiveIntakeText("api_key=supersecretvalue");
    assert.match(out, /\[redacted\]/);
    assert.doesNotMatch(out, /supersecretvalue/);
  });

  it("leaves benign intake text unchanged", () => {
    const text = "Needs barber shop website with booking.";
    assert.equal(redactSensitiveIntakeText(text), text);
  });
});
