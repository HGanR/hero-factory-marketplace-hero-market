import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferContent360SyncDisposition,
  normalizeContent360ProviderResponse,
} from "@/lib/social/providers/content360/content360-provider-response";

describe("content360-provider-response", () => {
  it("normalizeContent360ProviderResponse flattens objects", () => {
    const o = normalizeContent360ProviderResponse({ state: "published", externalPostId: "p1" });
    assert.equal(o.state, "published");
    assert.equal(o.externalPostId, "p1");
  });

  it("inferContent360SyncDisposition does not infer published from an empty 200 body", () => {
    assert.equal(inferContent360SyncDisposition({}, true), "unknown");
  });

  it("inferContent360SyncDisposition maps published strings", () => {
    assert.equal(inferContent360SyncDisposition({ state: "published" }, true), "published");
    assert.equal(inferContent360SyncDisposition({ status: "queued" }, true), "scheduled");
  });
});