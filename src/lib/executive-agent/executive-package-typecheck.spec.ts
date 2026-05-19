import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("package.json typecheck scripts", () => {
  it("clears .next then runs next build so generated types cannot go stale", () => {
    const raw = readFileSync(join(__dirname, "../../../package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts?: { typecheck?: string; typecheckTsc?: string } };
    const tc = pkg.scripts?.typecheck ?? "";
    assert.match(tc, /rm -rf \.next/);
    assert.match(tc, /next build/);
  });

  it("exposes strict TypeScript via typecheck:tsc (tsc only)", () => {
    const raw = readFileSync(join(__dirname, "../../../package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    const strict = pkg.scripts?.["typecheck:tsc"] ?? "";
    assert.match(strict, /tsc -p tsconfig\.typecheck\.json/);
  });
});
