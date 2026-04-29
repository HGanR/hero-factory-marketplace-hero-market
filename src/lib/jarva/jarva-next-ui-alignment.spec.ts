/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import type { JarvaNextUiAction } from "@/lib/jarva/jarva-next-ui-actions";
import {
  inferWizardStepLetter,
  isJarvaFocusStepAligned,
  jarvaHandoffLaneMatchesBundle,
} from "./jarva-next-ui-alignment";

describe("inferWizardStepLetter", () => {
  it("returns null when not on issue-security path", () => {
    expect(inferWizardStepLetter("/smart-trust", { stepFocus: "D" })).toBeNull();
  });

  it("prefers stepFocus when A–F", () => {
    expect(inferWizardStepLetter("/trusts/x/issue-security", { stepFocus: "d" })).toBe("D");
  });

  it("parses leading step letter from currentStep", () => {
    expect(inferWizardStepLetter("/trusts/x/issue-security", { currentStep: "D. Offering" })).toBe("D");
  });
});

describe("isJarvaFocusStepAligned", () => {
  const focusD: JarvaNextUiAction = {
    kind: "focus_step",
    target: "D",
    label: "x",
    autoApplyEligible: false,
  };

  it("is true when wizard matches", () => {
    expect(isJarvaFocusStepAligned(focusD, "D")).toBe(true);
  });

  it("is false when wizard differs or unknown", () => {
    expect(isJarvaFocusStepAligned(focusD, "C")).toBe(false);
    expect(isJarvaFocusStepAligned(focusD, null)).toBe(false);
  });
});

describe("jarvaHandoffLaneMatchesBundle", () => {
  it("matches jarvaLane query to bundle lane", () => {
    const sp = new URLSearchParams("jarvaLane=trust_ppm");
    expect(jarvaHandoffLaneMatchesBundle(sp, "trust_ppm")).toBe(true);
    expect(jarvaHandoffLaneMatchesBundle(sp, "trust_bond")).toBe(false);
  });

  it("is false when lane missing or invalid", () => {
    expect(jarvaHandoffLaneMatchesBundle(new URLSearchParams(), "trust_ppm")).toBe(false);
    expect(jarvaHandoffLaneMatchesBundle(new URLSearchParams("jarvaLane=bad"), "trust_ppm")).toBe(false);
  });
});
