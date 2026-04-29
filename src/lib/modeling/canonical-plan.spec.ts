import { describe, it, expect } from "@jest/globals";
import { canonicalizePlan, hashPlan } from "./canonical-plan";

describe("canonical-plan", () => {
  it("canonicalizePlan sorts keys and rounds numbers", () => {
    const plan = { d: 6.123456, version: 1, kind: "room", w: 8, h: 3 };
    const out = canonicalizePlan(plan);
    expect(Object.keys(out)).toEqual(["d", "h", "kind", "version", "w"]);
    expect((out as { w: number }).w).toBe(8);
    expect((out as { d: number }).d).toBeCloseTo(6.1235, 4);
  });

  it("hashPlan is deterministic", () => {
    const plan = { version: 1, kind: "room", w: 8, d: 6, h: 3 };
    const h1 = hashPlan(plan);
    const h2 = hashPlan({ d: 6, h: 3, kind: "room", version: 1, w: 8 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashPlan differs for different plans", () => {
    const a = hashPlan({ version: 1, kind: "room", w: 8, d: 6, h: 3 });
    const b = hashPlan({ version: 1, kind: "room", w: 10, d: 6, h: 3 });
    expect(a).not.toBe(b);
  });
});
