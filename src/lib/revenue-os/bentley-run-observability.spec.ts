import { computeResumedFromWorkflow } from "./bentley-run-observability";
import { defaultWorkflowState, markPhaseComplete } from "./bentley-workflow";

describe("computeResumedFromWorkflow", () => {
  it("is false for default empty workflow", () => {
    expect(computeResumedFromWorkflow(defaultWorkflowState())).toBe(false);
  });

  it("is true when lastFailedPhase is set", () => {
    const s = { ...defaultWorkflowState(), lastFailedPhase: "research" as const };
    expect(computeResumedFromWorkflow(s)).toBe(true);
  });

  it("is true when any pipeline phase beyond intake is complete", () => {
    let s = defaultWorkflowState();
    s = markPhaseComplete(s, "intake");
    s = markPhaseComplete(s, "research");
    expect(computeResumedFromWorkflow(s)).toBe(true);
  });
});
