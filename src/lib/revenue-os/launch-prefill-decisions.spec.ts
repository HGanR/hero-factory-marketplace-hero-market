import { decideStringPrefill } from "./launch-prefill-decisions";

describe("decideStringPrefill", () => {
  it("applies when current is empty", () => {
    expect(decideStringPrefill("", "hello")).toBe("apply");
    expect(decideStringPrefill("   ", "draft")).toBe("apply");
  });

  it("noops when proposed is empty", () => {
    expect(decideStringPrefill("existing", "")).toBe("noop");
    expect(decideStringPrefill("existing", "   ")).toBe("noop");
  });

  it("noops when trimmed values match", () => {
    expect(decideStringPrefill(" same ", "same")).toBe("noop");
  });

  it("confirm_replace when both non-empty and different (non-destructive path)", () => {
    expect(decideStringPrefill("user wrote notes", "Launch Mode draft")).toBe("confirm_replace");
  });
});
