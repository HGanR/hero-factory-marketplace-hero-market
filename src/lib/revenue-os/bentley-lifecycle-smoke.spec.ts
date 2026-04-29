/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runBentleyLifecycleSmokeVerification } from "@/lib/revenue-os/bentley-lifecycle-smoke";
import {
  defaultWorkflowState,
  resetWorkflowState,
  saveWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import type { BentleyFullLifecycleResult } from "@/lib/revenue-os/bentley-full-lifecycle-orchestrator";

describe("runBentleyLifecycleSmokeVerification", () => {
  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
  });

  it("returns blocked when intake is incomplete", async () => {
    saveWorkflowState(defaultWorkflowState());
    const r = await runBentleyLifecycleSmokeVerification({
      runFullLifecycle: jest.fn(),
    });
    expect(r.verdict).toBe("blocked");
    expect(r.pipelineStopped).toBe(true);
  });

  it("classifies waiting when lifecycle result carries gate reason", async () => {
    const wf = defaultWorkflowState();
    wf.completed.intake = true;
    saveWorkflowState(wf);

    const mockResult: BentleyFullLifecycleResult = {
      ok: true,
      stoppedAt: "complete",
      workflow: wf,
      reason: "Optimization gates blocked autonomous execution — see lifecycle.",
    };

    const r = await runBentleyLifecycleSmokeVerification({
      runFullLifecycle: jest.fn().mockResolvedValue(mockResult),
    });
    expect(r.verdict).toBe("waiting");
    expect(r.fullLifecycleResult.ok).toBe(true);
  });
});
