/** Step 167N.83A: regression guard until verified checkout is integrated. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of [
  "src/app/api/world-assets/[assetId]/purchase/route.ts",
  "src/app/api/v1/world-assets/[assetId]/purchase/route.ts",
]) {
  test(`paid purchases fail closed in ${path}`, () => {
    const source = readFileSync(path, "utf8");
    const guard = source.indexOf("if (asset.tokenPrice > 0)");
    const ownership = source.indexOf("await db.insert(userWorldAssets)");
    assert.ok(guard >= 0, "missing paid-purchase guard");
    assert.ok(ownership > guard, "guard must precede ownership issuance");
    assert.match(source.slice(guard, ownership), /TROO_CHECKOUT_NOT_READY/);
    assert.match(source.slice(guard, ownership), /status: 503/);
  });
}
