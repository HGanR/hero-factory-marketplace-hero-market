import test from "node:test";
import assert from "node:assert/strict";
import { computeStrategyPostingAlignment } from "@/lib/revenue-os/strategy-posting-alignment";

test("computeStrategyPostingAlignment coerces numeric platform labels without throwing", () => {
  const a = computeStrategyPostingAlignment(
    [0 as unknown as string, "Instagram", 42 as unknown as string],
    ["instagram"]
  );
  assert.equal(a.kind, "aligned");
  assert.ok(a.strategyOAuthIds.includes("instagram"));
});
