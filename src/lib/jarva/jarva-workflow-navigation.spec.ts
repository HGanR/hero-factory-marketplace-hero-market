import { describe, expect, it } from "@jest/globals";
import { shouldApplyWorkflowNavigation, sameAppDestination } from "@/lib/jarva/jarva-workflow-navigation";

describe("shouldApplyWorkflowNavigation", () => {
  it("only applies lane_control when source is lane_control", () => {
    expect(
      shouldApplyWorkflowNavigation("lane_control", "lane_control", "trust_bond")
    ).toBe(true);
    expect(
      shouldApplyWorkflowNavigation("lane_control", "sticky_session", "trust_bond")
    ).toBe(false);
  });

  it("does not navigate on lane_clear", () => {
    expect(
      shouldApplyWorkflowNavigation("lane_control", "lane_clear", null)
    ).toBe(false);
  });

  it("trust_type requires explicit_turn and revocable/irrevocable/ecclesiastical path", () => {
    expect(
      shouldApplyWorkflowNavigation("trust_type", "explicit_turn", "trust_revocable")
    ).toBe(true);
    expect(
      shouldApplyWorkflowNavigation("trust_type", "sticky_session", "trust_revocable")
    ).toBe(false);
    expect(
      shouldApplyWorkflowNavigation("trust_type", "explicit_turn", "trust_bond")
    ).toBe(false);
  });

  it("specialty_chat requires explicit_turn and a specialty path", () => {
    expect(
      shouldApplyWorkflowNavigation("specialty_chat", "explicit_turn", "trust_bond")
    ).toBe(true);
    expect(
      shouldApplyWorkflowNavigation("specialty_chat", "explicit_turn", "trust_revocable")
    ).toBe(false);
  });

  it("returns false without navIntent", () => {
    expect(shouldApplyWorkflowNavigation(undefined, "explicit_turn", "trust_bond")).toBe(false);
  });

  it("does not treat passive sticky_session as navigation trigger even with navIntent", () => {
    expect(
      shouldApplyWorkflowNavigation("lane_control", "sticky_session", "trust_bond")
    ).toBe(false);
  });
});

describe("sameAppDestination", () => {
  it("matches path and query regardless of param order", () => {
    const origin = "http://localhost:3000";
    expect(
      sameAppDestination("/trust-records?tab=bonds&trustId=x", "/trust-records?trustId=x&tab=bonds", origin)
    ).toBe(true);
    expect(sameAppDestination("/trust-records?tab=issue", "/ecclesiastical", origin)).toBe(false);
  });

  it("treats same page as equal when only Jarva handoff params differ", () => {
    const origin = "http://localhost:3000";
    expect(
      sameAppDestination(
        "/trust-records?trustId=x&tab=bonds",
        "/trust-records?trustId=x&tab=bonds&jarvaFrom=1&jarvaLane=trust_bond",
        origin
      )
    ).toBe(true);
  });
});
