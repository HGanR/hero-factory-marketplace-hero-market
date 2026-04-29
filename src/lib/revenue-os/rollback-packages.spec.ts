/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/revenue-os/policy-tuning-workbench", () => ({
  buildBentleyPolicyWorkbench: jest.fn(async () => ({
    currentPoliciesSummary: "0 policies",
    autonomousPolicyCount: 0,
    automationPolicyCount: 0,
    notificationPolicyCount: 0,
    basePolicySnapshotJson: { autonomous: [], automation: [], notifications: [] },
    empty: true,
  })),
}));

jest.mock("@/lib/revenue-os/policy-scenarios-db", () => ({
  getPolicyScenarioByIdForUser: jest.fn(async () => null),
}));

jest.mock("@/lib/revenue-os/policy-rollout-db", () => ({
  getPolicyRolloutPlanByIdForUser: jest.fn(async () => null),
}));
import {
  buildBentleyRollbackPackage,
  normalizePolicySnapshot,
  computeRollbackDeltaJson,
  summarizeBentleyRollbackPackage,
} from "@/lib/revenue-os/rollback-packages";
import { buildRollbackWorkbenchUiPayload } from "@/lib/revenue-os/rollback-ui";
import { buildBlendedRollbackBundle } from "@/lib/revenue-os/reversible-policy-bundles";

describe("rollback packages engine", () => {
  it("normalizePolicySnapshot handles empty input", () => {
    expect(normalizePolicySnapshot(null)).toEqual({
      autonomous: [],
      automation: [],
      notifications: [],
    });
  });

  it("computeRollbackDeltaJson produces delta for sparse state", () => {
    const cur = normalizePolicySnapshot({ autonomous: [], automation: [], notifications: [] });
    const tgt = normalizePolicySnapshot({ autonomous: [], automation: [], notifications: [] });
    const { deltaJson } = computeRollbackDeltaJson({ current: cur, target: tgt });
    expect(deltaJson).toHaveProperty("autonomous");
    expect(deltaJson).toHaveProperty("generatedAt");
  });

  it("summarizeBentleyRollbackPackage returns lines", () => {
    const s = summarizeBentleyRollbackPackage({
      deltaJson: { autonomous: { changes: [], changedIds: [] } },
      rollbackType: "blended",
      affectedPolicyFamilies: ["autonomous"],
      name: "Test",
    });
    expect(s.title).toBe("Test");
    expect(s.summaryLines.length).toBeGreaterThan(0);
  });

  it("buildBentleyRollbackPackage is resilient with no plan/scenario", async () => {
    const r = await buildBentleyRollbackPackage({
      userId: "u1",
      rollbackType: "blended",
      name: "x",
    });
    expect(r.rollbackPackage.rollbackTargetSnapshotJson).toBeDefined();
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
});

describe("rollback UI + bundles", () => {
  it("buildRollbackWorkbenchUiPayload renders with minimal engine", async () => {
    const engine = await buildBentleyRollbackPackage({ userId: "u1", rollbackType: "blended" });
    const bundle = await buildBlendedRollbackBundle({
      userId: "u1",
      rollbackTargetSnapshotJson: engine.rollbackPackage.rollbackTargetSnapshotJson,
      families: engine.affectedPolicyFamilies,
    });
    const ui = buildRollbackWorkbenchUiPayload({
      engine,
      packageRow: null,
      bundle,
      staleWarning: null,
    });
    expect(ui.summary.title).toBeDefined();
  });
});
