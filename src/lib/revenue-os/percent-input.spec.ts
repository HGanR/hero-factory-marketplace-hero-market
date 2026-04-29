import { clampPercentPoints, parsePercentFromUserText } from "./percent-input";

describe("parsePercentFromUserText", () => {
  const ok = (raw: string, expected: number) => {
    const r = parsePercentFromUserText(raw);
    expect(r).toEqual({ ok: true, percentPoints: expected });
  };

  it("parses percent-suffixed values as percent points", () => {
    ok("1%", 1);
    ok(" 2.5% ", 2.5);
    ok("0.8%", 0.8);
  });

  it("parses bare numbers as percent points (no hidden ×100)", () => {
    ok("2.5", 2.5);
    ok("25", 25);
    ok("1", 1);
  });

  it("rejects out-of-range values", () => {
    expect(parsePercentFromUserText("101")).toMatchObject({ ok: false, reason: "over_max" });
    expect(parsePercentFromUserText("-1")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects empty / whitespace-only input", () => {
    expect(parsePercentFromUserText("")).toMatchObject({ ok: false, reason: "empty" });
    expect(parsePercentFromUserText("   ")).toMatchObject({ ok: false, reason: "empty" });
  });

  it("strips currency and thousands separators before parsing", () => {
    expect(parsePercentFromUserText("$3.50%")).toEqual({ ok: true, percentPoints: 3.5 });
    expect(parsePercentFromUserText("$1,000%")).toMatchObject({ ok: false, reason: "over_max" });
  });

  it("treats 100 as valid percent points", () => {
    expect(parsePercentFromUserText("100%")).toEqual({ ok: true, percentPoints: 100 });
  });
});

describe("clampPercentPoints", () => {
  it("clamps to 0–100 and handles non-finite", () => {
    expect(clampPercentPoints(-5)).toBe(0);
    expect(clampPercentPoints(150)).toBe(100);
    expect(clampPercentPoints(NaN)).toBe(0);
  });
});
