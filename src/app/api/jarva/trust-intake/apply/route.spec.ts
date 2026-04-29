/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { runJarvaTrustApply } from "@/lib/jarva/run-jarva-apply";
import { loadLatestJarvaIntakePayload, saveJarvaIntakeDraft } from "@/lib/jarva/persist-jarva-intake-draft";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/jarva/run-jarva-apply", () => ({
  runJarvaTrustApply: jest.fn(),
}));

jest.mock("@/lib/jarva/persist-jarva-intake-draft", () => ({
  loadLatestJarvaIntakePayload: jest.fn(),
  saveJarvaIntakeDraft: jest.fn(),
  mergeJarvaIntakeSaveMetadata: jest.requireActual("@/lib/jarva/persist-jarva-intake-draft").mergeJarvaIntakeSaveMetadata,
}));

const getAuthedUserIdMock = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const runJarvaTrustApplyMock = runJarvaTrustApply as jest.MockedFunction<typeof runJarvaTrustApply>;
const loadLatestJarvaIntakePayloadMock = loadLatestJarvaIntakePayload as jest.MockedFunction<
  typeof loadLatestJarvaIntakePayload
>;
const saveJarvaIntakeDraftMock = saveJarvaIntakeDraft as jest.MockedFunction<typeof saveJarvaIntakeDraft>;

const TRUST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = 99;

const workspaceSummary = {
  trust: { id: TRUST_ID, clientId: null, name: "WS", trustType: null, jurisdictionState: "NY", workspaceStatus: null },
  counts: { parties: 1, beneficiaries: 0, assets: 0 },
};

function makeDb() {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([{ id: TRUST_ID, userId: USER_ID, source: null }])),
        })),
      })),
    })),
  };
}

const validBody = {
  trustId: TRUST_ID,
  intake: {
    schemaVersion: 1,
    grantor: { name: "G" },
    trustee: { name: "T" },
    governingState: "NY",
    objectives: "Goals",
  },
};

describe("POST /api/jarva/trust-intake/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthedUserIdMock.mockResolvedValue(USER_ID);
    getDbMock.mockResolvedValue(makeDb() as Awaited<ReturnType<typeof getDb>>);
    runJarvaTrustApplyMock.mockResolvedValue({
      ok: true,
      readiness: { ok: true, missing: [], blockers: [], advisories: [] },
      smartTrustVersion: 5,
      smartDraftId: "sd-1",
      trustRecordsVersion: 2,
      trustRecordsSynced: true,
      workspaceSummary: workspaceSummary as Awaited<
        ReturnType<typeof import("@/lib/trusts/build-workspace-summary").buildWorkspaceSummaryForTrust>
      >,
    });
    loadLatestJarvaIntakePayloadMock.mockResolvedValue({
      payload: { intake: validBody.intake as any, schemaVersion: 1, lineage: [] },
      version: 1,
    });
    saveJarvaIntakeDraftMock.mockResolvedValue({ draftId: "j1", nextVersion: 2, jarvaMode: "assist" });
  });

  it("returns workspaceSummary and draft framing message on success", async () => {
    const req = new Request("http://localhost/api/jarva/trust-intake/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.workspaceSummary).toEqual(workspaceSummary);
    expect(String(data.message)).toContain("Draft workspace updated");
    expect(String(data.message)).toContain("counsel");
  });

  it("appends manual_apply lineage via saveJarvaIntakeDraft", async () => {
    const req = new Request("http://localhost/api/jarva/trust-intake/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as any);

    expect(saveJarvaIntakeDraftMock).toHaveBeenCalled();
    const call = saveJarvaIntakeDraftMock.mock.calls.find((c) => c[0].auditAction === "jarva_manual_apply_lineage");
    expect(call).toBeDefined();
    const lineage = call![0].lineage as { applyKind?: string }[];
    expect(lineage.some((e) => e.applyKind === "manual_apply")).toBe(true);
  });

  it("still returns 200 with workspaceSummary when lineage save fails (best-effort)", async () => {
    saveJarvaIntakeDraftMock.mockRejectedValueOnce(new Error("disk full"));
    const req = new Request("http://localhost/api/jarva/trust-intake/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.workspaceSummary).toEqual(workspaceSummary);
  });

  it("returns 409 when runJarvaTrustApply reports readiness blocked", async () => {
    runJarvaTrustApplyMock.mockResolvedValueOnce({
      ok: false,
      error: "READINESS_BLOCKED",
      readiness: { ok: false, missing: ["Grantor name"], blockers: [], advisories: [] },
    });
    const req = new Request("http://localhost/api/jarva/trust-intake/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID, intake: { schemaVersion: 1 } }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(409);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("READINESS_BLOCKED");
    expect(saveJarvaIntakeDraftMock).not.toHaveBeenCalled();
  });
});
