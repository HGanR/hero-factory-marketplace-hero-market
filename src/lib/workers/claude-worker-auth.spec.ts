import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLAUDE_WORKER_KEY_PREFIX,
  generateClaudeWorkerApiKey,
  hashClaudeWorkerApiKey,
  validateClaudeWorkerBearerFormat,
} from "@/lib/workers/claude-worker-key-generate";
import {
  CLAUDE_WORKER_HANDOFF_SCOPE,
  parseClaudeWorkerScopesJson,
  scopesIncludeHandoffSubmit,
  serializeClaudeWorkerScopes,
} from "@/lib/workers/claude-worker-scopes";

describe("claude worker bearer format", () => {
  it("accepts hf_cwd_ keys of sufficient length", () => {
    const { raw } = generateClaudeWorkerApiKey();
    const r = validateClaudeWorkerBearerFormat(raw);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.token.startsWith(CLAUDE_WORKER_KEY_PREFIX));
  });

  it("rejects JWT-like tokens", () => {
    assert.equal(validateClaudeWorkerBearerFormat("eyJhbGciOiJIUzI1NiJ9.payload.sig").ok, false);
  });

  it("rejects developer hf_live_ keys", () => {
    assert.equal(
      validateClaudeWorkerBearerFormat("hf_live_abcdefghijklmnopqrstuvwxyz12").ok,
      false
    );
  });

  it("rejects wrong prefix and empty bearer", () => {
    assert.equal(validateClaudeWorkerBearerFormat("hf_cwd_short").ok, false);
    assert.equal(validateClaudeWorkerBearerFormat("").ok, false);
    assert.equal(validateClaudeWorkerBearerFormat(null).code, "missing");
  });
});

describe("claude worker key material", () => {
  it("generates stable sha256 hashes", () => {
    const { raw, hash } = generateClaudeWorkerApiKey();
    assert.equal(hash, hashClaudeWorkerApiKey(raw));
    assert.ok(raw.startsWith(CLAUDE_WORKER_KEY_PREFIX));
  });

  it("defaults scopes to fulfillment handoff submit", () => {
    const { scopesJson } = generateClaudeWorkerApiKey();
    const scopes = parseClaudeWorkerScopesJson(scopesJson);
    assert.ok(scopesIncludeHandoffSubmit(scopes));
    assert.deepEqual(scopes, [CLAUDE_WORKER_HANDOFF_SCOPE]);
    assert.equal(
      serializeClaudeWorkerScopes([CLAUDE_WORKER_HANDOFF_SCOPE]),
      scopesJson
    );
  });
});
