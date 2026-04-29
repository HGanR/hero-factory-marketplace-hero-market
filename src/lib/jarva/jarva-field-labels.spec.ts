import { describe, expect, it } from "@jest/globals";
import { getJarvaIntakeValueForFieldKeyPreferForm } from "./jarva-field-labels";

describe("getJarvaIntakeValueForFieldKeyPreferForm", () => {
  it("uses saved intake when the form snapshot omits a nested path", () => {
    const form = { schemaVersion: 1, grantor: { name: "Ada" } } as Record<string, unknown>;
    const saved = { grantor: { name: "Ada", email: "ada@example.com" } } as Record<string, unknown>;
    expect(getJarvaIntakeValueForFieldKeyPreferForm(form, saved, "grantor.email")).toBe("ada@example.com");
  });

  it("prefers non-empty form values over saved", () => {
    const form = { grantor: { name: "B", email: "b@example.com" } } as Record<string, unknown>;
    const saved = { grantor: { email: "old@example.com" } } as Record<string, unknown>;
    expect(getJarvaIntakeValueForFieldKeyPreferForm(form, saved, "grantor.email")).toBe("b@example.com");
  });
});
