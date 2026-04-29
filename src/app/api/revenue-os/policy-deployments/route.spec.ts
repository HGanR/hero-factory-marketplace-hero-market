/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST as POSTPrepare } from "./prepare/route";
import { POST as POSTSave } from "./save/route";
import { POST as POSTApply } from "./apply/route";
import { GET as GETById } from "./[id]/route";
import { getAuthedUserId } from "@/lib/api/auth";
import * as policyChangeSets from "@/lib/revenue-os/policy-change-sets";
import * as policyDeployment from "@/lib/revenue-os/policy-deployment";
import * as policyDeploymentAudit from "@/lib/revenue-os/policy-deployment-audit";
import * as changeSetsDb from "@/lib/revenue-os/policy-change-sets-db";
import * as policyDeploymentHistory from "@/lib/revenue-os/policy-deployment-history";
import { applyBentleyPolicyUpsertItem } from "@/lib/revenue-os/policy-upsert-apply";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/revenue-os/bentley-correlation-server", () => ({
  logBentleyCorrelationEvent: jest.fn(),
}));

jest.mock("@/lib/revenue-os/policy-change-sets", () => {
  const actual = jest.requireActual("@/lib/revenue-os/policy-change-sets") as typeof policyChangeSets;
  return {
    ...actual,
    buildBentleyPolicyChangeSet: jest.fn(),
    buildBentleyRollbackChangeSet: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/policy-deployment", () => {
  const actual = jest.requireActual("@/lib/revenue-os/policy-deployment") as typeof policyDeployment;
  return {
    ...actual,
    applyBentleyPolicyChangeSet: jest.fn(),
    fetchBentleyPolicyChangeSetState: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/policy-deployment-audit", () => ({
  writePolicyChangeSetAudit: jest.fn(async () => {}),
}));

jest.mock("@/lib/revenue-os/policy-deployment-notifications", () => ({
  emitPolicyDeploymentNotification: jest.fn(async () => ({ ok: true })),
}));

jest.mock("@/lib/revenue-os/policy-deployment-history", () => {
  const actual = jest.requireActual("@/lib/revenue-os/policy-deployment-history") as typeof policyDeploymentHistory;
  return {
    ...actual,
    describeRollbackLinkageForChangeSet: jest.fn(),
  };
});

jest.mock("@/lib/revenue-os/policy-upsert-apply", () => ({
  applyBentleyPolicyUpsertItem: jest.fn(async () => ({ ok: true })),
}));

const mockAuth = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockBuildForward = policyChangeSets.buildBentleyPolicyChangeSet as jest.MockedFunction<
  typeof policyChangeSets.buildBentleyPolicyChangeSet
>;
const mockBuildRollback = policyChangeSets.buildBentleyRollbackChangeSet as jest.MockedFunction<
  typeof policyChangeSets.buildBentleyRollbackChangeSet
>;
const mockApplyChangeSet = policyDeployment.applyBentleyPolicyChangeSet as jest.MockedFunction<
  typeof policyDeployment.applyBentleyPolicyChangeSet
>;
const mockFetchState = policyDeployment.fetchBentleyPolicyChangeSetState as jest.MockedFunction<
  typeof policyDeployment.fetchBentleyPolicyChangeSetState
>;
const mockDescribeRollback = policyDeploymentHistory.describeRollbackLinkageForChangeSet as jest.MockedFunction<
  typeof policyDeploymentHistory.describeRollbackLinkageForChangeSet
>;
const mockUpsertItem = applyBentleyPolicyUpsertItem as jest.MockedFunction<typeof applyBentleyPolicyUpsertItem>;

function makeSparseChangeSetResult(): Awaited<ReturnType<typeof policyChangeSets.buildBentleyPolicyChangeSet>> {
  return {
    changeSet: {
      name: "Sparse",
      description: null,
      changeSetType: "forward_deploy",
      scopeJson: null,
      sourceScenarioId: "sc-1",
      sourceRolloutPlanId: null,
      sourceRollbackPackageId: null,
      status: "draft",
    },
    items: [],
    deploymentSummary: {
      totalItems: 0,
      applicableItems: 0,
      skippedItems: 0,
      families: [],
    },
    riskSummary: { lines: [], partialFailureCount: 0 },
    rollbackLinkage: {
      rollbackPackageId: null,
      linkedScenarioId: "sc-1",
      advisoryLine: "advisory",
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue("user-1");
  mockBuildForward.mockResolvedValue(makeSparseChangeSetResult());
  mockBuildRollback.mockResolvedValue({
    ...makeSparseChangeSetResult(),
    changeSet: {
      ...makeSparseChangeSetResult().changeSet,
      changeSetType: "rollback_deploy",
      sourceRollbackPackageId: "pkg-1",
    },
  });
  mockDescribeRollback.mockResolvedValue({
    rollbackPackageId: null,
    packageName: null,
    line: "No rollback package linked to this change set.",
  });
});

describe("POST /api/revenue-os/policy-deployments/prepare", () => {
  it("returns 401 when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/prepare", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await POSTPrepare(req);
    expect(res.status).toBe(401);
    expect(mockBuildForward).not.toHaveBeenCalled();
  });

  it("builds change set without calling live upsert helper", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/prepare", {
      method: "POST",
      body: JSON.stringify({ scenarioId: "sc-1", name: "N" }),
    });
    const res = await POSTPrepare(req);
    expect(res.status).toBe(200);
    expect(mockBuildForward).toHaveBeenCalled();
    expect(mockUpsertItem).not.toHaveBeenCalled();
    const json = (await res.json()) as { deploymentSummary: { totalItems: number } };
    expect(json.deploymentSummary.totalItems).toBe(0);
  });

  it("uses rollback path when rollbackPackageId is set", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/prepare", {
      method: "POST",
      body: JSON.stringify({ rollbackPackageId: "pkg-1" }),
    });
    const res = await POSTPrepare(req);
    expect(res.status).toBe(200);
    expect(mockBuildRollback).toHaveBeenCalled();
    expect(mockBuildForward).not.toHaveBeenCalled();
    expect(mockUpsertItem).not.toHaveBeenCalled();
  });
});

describe("POST /api/revenue-os/policy-deployments/save", () => {
  it("returns 401 when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/save", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POSTSave(req);
    expect(res.status).toBe(401);
  });

  it("persists without calling live upsert helper", async () => {
    const insertSpy = jest.spyOn(changeSetsDb, "insertPolicyChangeSet").mockResolvedValue({
      id: "cs-1",
      userId: "user-1",
      name: "Sparse",
      description: null,
      changeSetType: "forward_deploy",
      scopeJson: null,
      status: "ready",
      sourceScenarioId: "sc-1",
      sourceRolloutPlanId: null,
      sourceRollbackPackageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as import("@/lib/revenue-os/policy-change-sets-db").PolicyChangeSetRow);
    const replaceSpy = jest.spyOn(changeSetsDb, "replaceChangeSetItems").mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/save", {
      method: "POST",
      body: JSON.stringify({ scenarioId: "sc-1" }),
    });
    const res = await POSTSave(req);
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalled();
    expect(mockUpsertItem).not.toHaveBeenCalled();

    insertSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("returns 404 when updating unknown change set id", async () => {
    jest.spyOn(changeSetsDb, "getPolicyChangeSetByIdForUser").mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/save", {
      method: "POST",
      body: JSON.stringify({ changeSetId: "missing" }),
    });
    const res = await POSTSave(req);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/revenue-os/policy-deployments/apply", () => {
  it("returns 401 when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/apply", {
      method: "POST",
      body: JSON.stringify({ changeSetId: "cs-1", confirm: true }),
    });
    const res = await POSTApply(req);
    expect(res.status).toBe(401);
    expect(mockApplyChangeSet).not.toHaveBeenCalled();
  });

  it("rejects apply without confirm: true", async () => {
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/apply", {
      method: "POST",
      body: JSON.stringify({ changeSetId: "cs-1", confirm: false }),
    });
    const res = await POSTApply(req);
    expect(res.status).toBe(400);
    expect(mockApplyChangeSet).not.toHaveBeenCalled();
  });

  it("returns partial failure shape from orchestration", async () => {
    mockApplyChangeSet.mockResolvedValueOnce({
      ok: true,
      runId: "run-1",
      applied: 1,
      failed: 1,
      skipped: 0,
      errors: ["autonomous x: bad"],
      changeSetStatus: "partially_applied",
    });
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/apply", {
      method: "POST",
      body: JSON.stringify({ changeSetId: "cs-1", confirm: true }),
    });
    const res = await POSTApply(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { changeSetStatus: string; failed: number };
    expect(json.changeSetStatus).toBe("partially_applied");
    expect(json.failed).toBe(1);
  });

  it("successful apply path uses mocked orchestration (wraps shared upsert in production)", async () => {
    mockApplyChangeSet.mockResolvedValueOnce({
      ok: true,
      runId: "run-2",
      applied: 2,
      failed: 0,
      skipped: 0,
      errors: [],
      changeSetStatus: "completed",
    });
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/apply", {
      method: "POST",
      body: JSON.stringify({ changeSetId: "cs-1", confirm: true }),
    });
    const res = await POSTApply(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; applied: number };
    expect(json.ok).toBe(true);
    expect(json.applied).toBe(2);
    expect(mockApplyChangeSet).toHaveBeenCalledWith({
      userId: "user-1",
      changeSetId: "cs-1",
      confirm: true,
    });
  });
});

describe("GET /api/revenue-os/policy-deployments/[id]", () => {
  it("returns 401 when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/cs-1");
    const res = await GETById(req, { params: Promise.resolve({ id: "cs-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when change set not owned or missing", async () => {
    mockFetchState.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/other");
    const res = await GETById(req, { params: Promise.resolve({ id: "other" }) });
    expect(res.status).toBe(404);
  });

  it("returns state and ui for owner", async () => {
    mockFetchState.mockResolvedValueOnce({
      changeSet: {
        id: "cs-1",
        userId: "user-1",
        name: "Test",
        description: null,
        changeSetType: "forward_deploy",
        scopeJson: null,
        status: "ready",
        sourceScenarioId: null,
        sourceRolloutPlanId: null,
        sourceRollbackPackageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      items: [],
      runs: [],
    });
    const req = new NextRequest("http://localhost/api/revenue-os/policy-deployments/cs-1");
    const res = await GETById(req, { params: Promise.resolve({ id: "cs-1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { changeSet: { id: string }; ui: { perFamilyTable: unknown } };
    expect(json.changeSet.id).toBe("cs-1");
    expect(json.ui.perFamilyTable).toEqual([]);
  });
});
