import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const SCRIPT = join(ROOT, "scripts/typecheck-empty-modules-report.mjs");

describe("typecheck-empty-modules-report.mjs", () => {
  it("exits 0 in read-only mode (no --write)", () => {
    const r = spawnSync(process.execPath, [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout ?? "", /Scanned \d+ files/);
  });
});
