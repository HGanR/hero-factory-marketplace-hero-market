import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeHttpSchedulePostResult } from "@/lib/social/providers/content360/content360-vendor-schedule-response";

describe("content360-vendor-schedule-response", () => {
  it("normalizeHttpSchedulePostResult preserves raw body and does not invent schedule id on empty success", () => {
    const r = normalizeHttpSchedulePostResult({ httpOk: true, status: 200, body: {} });
    assert.equal(r.ok, true);
    assert.equal(r.externalScheduleId, null);
    assert.ok(r.raw && typeof r.raw === "object");
  });
});
