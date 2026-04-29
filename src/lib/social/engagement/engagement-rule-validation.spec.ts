import { describe, expect, it } from "@jest/globals";
import { parseCreateRuleBody, validateRulePayload } from "./engagement-rule-validation";

describe("engagement-rule-validation", () => {
  it("rejects empty conditions", () => {
    const r = validateRulePayload({}, { addLabelSlug: "vip" });
    expect("error" in r && r.error).toMatch(/at least one condition/i);
  });

  it("accepts keywords + label action", () => {
    const r = validateRulePayload({ keywordsAny: ["refund"] }, { addLabelSlug: "urgent" });
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.conditions.keywordsAny).toEqual(["refund"]);
      expect(r.actions.addLabelSlug).toBe("urgent");
    }
  });

  it("parseCreateRuleBody surfaces API errors", () => {
    const bad = parseCreateRuleBody({
      conditionsJson: {},
      actionsJson: { addLabelSlug: "x" },
    });
    expect("error" in bad).toBe(true);
  });

  it("validates intent and source enums", () => {
    const r1 = validateRulePayload({ intentEquals: "nope" as never }, { addLabelSlug: "x" });
    expect("error" in r1).toBe(true);
    const r2 = validateRulePayload({ intentEquals: "lead" }, { assignRole: "owner" });
    expect("error" in r2).toBe(false);
  });
});
