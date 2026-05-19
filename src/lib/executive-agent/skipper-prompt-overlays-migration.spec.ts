import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSkipperPromptOverlaysMissingTableError } from "@/lib/executive-agent/skipper-prompt-overlays-table-errors";

describe("skipper_prompt_overlays migration guard", () => {
  it("detects missing-table errors from message shape", () => {
    assert.equal(
      isSkipperPromptOverlaysMissingTableError(new Error("Table 'db.skipper_prompt_overlays' doesn't exist")),
      true,
    );
    assert.equal(
      isSkipperPromptOverlaysMissingTableError(new Error("Unknown table 'skipper_prompt_overlays'")),
      true,
    );
    assert.equal(isSkipperPromptOverlaysMissingTableError(new Error("some other failure")), false);
    assert.equal(
      isSkipperPromptOverlaysMissingTableError(new Error("Table 'other' doesn't exist")),
      false,
    );
  });

  it("detects missing-table from errno / sqlstate on Error", () => {
    const e = new Error("Table 'db.skipper_prompt_overlays' doesn't exist");
    Object.assign(e, { errno: 1146 });
    assert.equal(isSkipperPromptOverlaysMissingTableError(e), true);
    const e2 = new Error("Unknown table 'skipper_prompt_overlays'");
    Object.assign(e2, { code: "ER_NO_SUCH_TABLE" });
    assert.equal(isSkipperPromptOverlaysMissingTableError(e2), true);
  });

  it("listActiveSkipperPromptOverlaysForAdmin degrades on missing table (source contract)", () => {
    const p = join(__dirname, "skipper-learning-store.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("listActiveSkipperPromptOverlaysForAdmin"));
    assert.ok(src.includes("isSkipperPromptOverlaysMissingTableError"));
    assert.ok(src.includes("return []"));
  });

  it("runtime diagnostics exposes promptOverlaysStatus", () => {
    const p = join(__dirname, "executive-skipper-runtime-diagnostics.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("promptOverlaysStatus"));
    assert.ok(src.includes("probeSkipperPromptOverlaysTableStatus"));
  });
});
