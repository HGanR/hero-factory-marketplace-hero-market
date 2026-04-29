import { describe, expect, it } from "@jest/globals";

/** Mirrors RevenueOsInboxPanel summary useMemo (contract test for status buckets). */
function summarizeInbox(
  items: { status: string; requiresManual: boolean; provider: string }[]
) {
  const nNew = items.filter((i) => i.status === "new").length;
  const wait = items.filter((i) => i.status === "waiting" || i.status === "triaged").length;
  const manual = items.filter((i) => i.status === "manual_only" || i.requiresManual).length;
  const byProv = items.reduce<Record<string, number>>((m, i) => {
    m[i.provider] = (m[i.provider] || 0) + 1;
    return m;
  }, {});
  return { nNew, wait, manual, byProv };
}

describe("inbox thread summary (panel contract)", () => {
  it("counts new, triage/waiting, and manual; groups by provider", () => {
    const s = summarizeInbox([
      { status: "new", requiresManual: false, provider: "meta" },
      { status: "new", requiresManual: true, provider: "meta" },
      { status: "triaged", requiresManual: false, provider: "x" },
      { status: "resolved", requiresManual: false, provider: "x" },
      { status: "waiting", requiresManual: false, provider: "linkedin" },
    ]);
    expect(s.nNew).toBe(2);
    expect(s.wait).toBe(2);
    expect(s.manual).toBe(1);
    expect(s.byProv).toEqual({ meta: 2, x: 2, linkedin: 1 });
  });
});
