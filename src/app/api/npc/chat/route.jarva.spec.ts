/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { extractJarvaIntakeFromChat } from "@/lib/jarva/jarva-intake-from-chat";
import { runJarvaTrustApply } from "@/lib/jarva/run-jarva-apply";
import {
  loadLatestJarvaIntakePayload,
  saveJarvaIntakeDraft,
} from "@/lib/jarva/persist-jarva-intake-draft";
import { buildNpcResponse } from "@/lib/npc/engine";
import { getSessionBySessionId, updateSessionJarvaWorkflowPath } from "@/lib/npc/db";
import { computeJarvaDocumentAssemblyHintsFallback } from "@/lib/jarva/jarva-document-assembly-hints-fallback";

jest.mock("@/lib/jarva/jarva-document-assembly-hints-fallback", () => ({
  computeJarvaDocumentAssemblyHintsFallback: jest.fn(),
}));

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/npc/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, retryAfterSec: null })),
}));

jest.mock("@/lib/npc/db", () => ({
  getNpcByNpcId: jest.fn().mockResolvedValue({ npcId: "trust-advisor", name: "Jarva" }),
  getNpcRowByNpcId: jest.fn().mockResolvedValue({ id: 1, npcId: "trust-advisor" }),
  getKnowledgeForNpc: jest.fn().mockResolvedValue([]),
  addMessage: jest.fn().mockResolvedValue(undefined),
  createSession: jest.fn().mockResolvedValue(undefined),
  getSessionBySessionId: jest.fn(),
  updateSessionJarvaWorkflowPath: jest.fn(),
  getMessagesForSession: jest.fn().mockResolvedValue([]),
  incrementSessionMessageCount: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/npc/engine", () => ({
  buildNpcResponse: jest.fn(() => ({
    text: "Rule reply",
    source: "rule",
    intent: "help",
    mood: "neutral",
    suggestions: [],
  })),
}));

jest.mock("@/lib/npc/llm-bridge", () => ({
  generateLlmResponse: jest.fn(),
}));

jest.mock("@/lib/audit", () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/jarva/jarva-intake-from-chat", () => ({
  extractJarvaIntakeFromChat: jest.fn(),
  mergeJarvaIntakeBases: jest.requireActual("@/lib/jarva/jarva-intake-from-chat").mergeJarvaIntakeBases,
}));

jest.mock("@/lib/jarva/persist-jarva-intake-draft", () => ({
  loadLatestJarvaIntakePayload: jest.fn(),
  saveJarvaIntakeDraft: jest.fn().mockResolvedValue({ draftId: "d", nextVersion: 1, jarvaMode: "assist" }),
  mergeJarvaIntakeSaveMetadata: jest.requireActual("@/lib/jarva/persist-jarva-intake-draft").mergeJarvaIntakeSaveMetadata,
  JARVA_INTAKE_DRAFT_TYPE: "jarva-trust-intake",
}));

jest.mock("@/lib/jarva/run-jarva-apply", () => ({
  runJarvaTrustApply: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const getAuthedUserIdMock = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const extractJarvaIntakeFromChatMock = extractJarvaIntakeFromChat as jest.MockedFunction<typeof extractJarvaIntakeFromChat>;
const runJarvaTrustApplyMock = runJarvaTrustApply as jest.MockedFunction<typeof runJarvaTrustApply>;
const loadLatestJarvaIntakePayloadMock = loadLatestJarvaIntakePayload as jest.MockedFunction<
  typeof loadLatestJarvaIntakePayload
>;
const saveJarvaIntakeDraftMock = saveJarvaIntakeDraft as jest.MockedFunction<typeof saveJarvaIntakeDraft>;
const buildNpcResponseMock = buildNpcResponse as jest.MockedFunction<typeof buildNpcResponse>;
const getSessionBySessionIdMock = getSessionBySessionId as jest.MockedFunction<typeof getSessionBySessionId>;
const updateSessionJarvaWorkflowPathMock = updateSessionJarvaWorkflowPath as jest.MockedFunction<
  typeof updateSessionJarvaWorkflowPath
>;
const computeJarvaDocumentAssemblyHintsFallbackMock =
  computeJarvaDocumentAssemblyHintsFallback as jest.MockedFunction<
    typeof computeJarvaDocumentAssemblyHintsFallback
  >;

/** In-memory sticky path for session row mock (mirrors DB column). */
let mockSessionJarvaWorkflowPath: string | null = null;

const TRUST_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = 7;

const extractionOk = {
  intakePatch: {
    grantor: { name: "Grantor" },
    trustee: { name: "Trustee" },
    governingState: "NY",
    objectives: "Avoid probate",
  },
  confidence: { "grantor.name": "high" as const },
  notes: [],
  followUps: [],
  fieldKeys: ["grantor.name", "trustee.name", "governingState", "objectives"],
};

const ws = {
  trust: { id: TRUST_ID, clientId: null, name: "N", trustType: null, jurisdictionState: "NY", workspaceStatus: null },
  counts: { parties: 3, beneficiaries: 1, assets: 0 },
};

const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeChatDb(opts?: { withClientSelect?: boolean }) {
  const withClientSelect = opts?.withClientSelect ?? false;
  let selectCalls = 0;
  const trustsChain = {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() =>
          Promise.resolve([{ id: TRUST_ID, userId: USER_ID, source: null, name: "T", clientId: null }])
        ),
      })),
    })),
  };
  const clientsChain = {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() =>
          Promise.resolve([
            {
              id: CLIENT_ID,
              userId: USER_ID,
              firstName: "A",
              middleName: null,
              lastName: "Client",
              suffix: null,
              title: null,
              email: null,
              phone: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              country: null,
            },
          ])
        ),
      })),
    })),
  };
  const smartDraftChain = {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
  return {
    select: jest.fn(() => {
      selectCalls += 1;
      if (withClientSelect) {
        if (selectCalls === 1) return trustsChain;
        if (selectCalls === 2) return clientsChain;
        if (selectCalls === 3) return smartDraftChain;
        return trustsChain;
      }
      if (selectCalls === 2) return smartDraftChain;
      return trustsChain;
    }),
    insert: jest.fn(() => ({
      values: jest.fn(() => Promise.resolve()),
    })),
  };
}

async function postJarva(body: Record<string, unknown>) {
  const req = new Request("http://localhost/api/npc/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/npc/chat — Jarva trust-advisor path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    computeJarvaDocumentAssemblyHintsFallbackMock.mockResolvedValue(null);
    mockSessionJarvaWorkflowPath = null;
    getSessionBySessionIdMock.mockImplementation(async (sessionId: string) => ({
      id: 1,
      sessionId,
      npcRowId: 1,
      jarvaWorkflowPath: mockSessionJarvaWorkflowPath,
    }));
    updateSessionJarvaWorkflowPathMock.mockImplementation(async (_sessionId: string, path: string) => {
      mockSessionJarvaWorkflowPath = path;
    });
    getAuthedUserIdMock.mockResolvedValue(USER_ID);
    getDbMock.mockImplementation(() => makeChatDb() as Awaited<ReturnType<typeof getDb>>);
    extractJarvaIntakeFromChatMock.mockResolvedValue(extractionOk);
    loadLatestJarvaIntakePayloadMock.mockResolvedValue({ payload: null, version: 0 });
    runJarvaTrustApplyMock.mockResolvedValue({
      ok: true,
      readiness: { ok: true, missing: [], blockers: [], advisories: [] },
      smartTrustVersion: 9,
      smartDraftId: "sd",
      trustRecordsVersion: 4,
      trustRecordsSynced: true,
      workspaceSummary: ws as Awaited<
        ReturnType<typeof import("@/lib/trusts/build-workspace-summary").buildWorkspaceSummaryForTrust>
      >,
    });
  });

  it("assist mode saves intake but does not auto-apply without jarvaAutoApply", async () => {
    const res = await postJarva({
      message: "grantor: Test",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(saveJarvaIntakeDraftMock).toHaveBeenCalled();
    expect(runJarvaTrustApplyMock).not.toHaveBeenCalled();
    expect(data.jarvaAutoApplied).toBe(false);
    expect(data.jarvaReadiness).toBeDefined();
    expect(data.jarvaNextActions).toBeDefined();
  });

  it("build mode auto-applies when structural readiness passes", async () => {
    const res = await postJarva({
      message: "grantor: Test",
      npcId: "trust-advisor",
      jarvaMode: "build",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(runJarvaTrustApplyMock).toHaveBeenCalledTimes(1);
    expect(data.jarvaAutoApplied).toBe(true);
    expect(data.jarvaWorkspaceSummary).toEqual(ws);
  });

  it("assist mode auto-applies when jarvaAutoApply is true and readiness passes", async () => {
    await postJarva({
      message: "x",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      jarvaAutoApply: true,
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(runJarvaTrustApplyMock).toHaveBeenCalled();
  });

  it("review mode does not persist intake or apply", async () => {
    const res = await postJarva({
      message: "x",
      npcId: "trust-advisor",
      jarvaMode: "review",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    expect(saveJarvaIntakeDraftMock).not.toHaveBeenCalled();
    expect(runJarvaTrustApplyMock).not.toHaveBeenCalled();
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.jarvaReviewOnly).toBe(true);
    expect(data.jarvaReadiness).toBeDefined();
    expect(data.jarvaNextActions).toBeDefined();
    expect(data.jarvaApplyReadiness).toBeDefined();
  });

  it("returns jarvaWorkspaceSummary shape suitable for jarva-workspace-updated listeners after auto-apply", async () => {
    const res = await postJarva({
      message: "x",
      npcId: "trust-advisor",
      jarvaMode: "build",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const summary = data.jarvaWorkspaceSummary as typeof ws;
    expect(summary).toEqual(ws);
    expect(summary.trust?.id).toBe(TRUST_ID);
    expect(summary.counts?.parties).toBe(3);
  });

  it("passes procedural context into buildNpcResponse for trust-advisor (step, index, blockers)", async () => {
    await postJarva({
      message: "grantor: Test",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(buildNpcResponseMock).toHaveBeenCalled();
    const arg = buildNpcResponseMock.mock.calls[0]![0] as {
      context?: { jarvaProceduralStep?: string; jarvaProceduralBlockers?: string[]; jarvaProceduralIndex?: number };
    };
    expect(arg.context?.jarvaProceduralStep).toBeTruthy();
    expect(arg.context?.jarvaProceduralIndex).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(arg.context?.jarvaProceduralBlockers)).toBe(true);
  });

  it("returns filtered jarvaNextActions and procedural metadata in JSON", async () => {
    const res = await postJarva({
      message: "x",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const na = data.jarvaNextActions as { nextQuestionItems: { question: string; priority: number }[] };
    expect(na.nextQuestionItems.length).toBeGreaterThan(0);
    expect(data.jarvaProceduralStep).toBeTruthy();
    expect(data.jarvaProceduralTitle).toBeTruthy();
    expect(data.jarvaProceduralBlockers).toBeDefined();
  });

  it("front-door: first message without workspace context greets and classifies entry", async () => {
    const res = await postJarva({
      message: "hi",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { response: string; jarvaEntryIntent?: string; jarvaProceduralStep?: string };
    expect(data.response).toContain("Hello");
    expect(data.jarvaEntryIntent).toBe("unknown");
    expect(data.jarvaProceduralStep).toBe("front_door");
  });

  it("front-door: trust alone asks for revocable / irrevocable / ecclesiastical", async () => {
    const res = await postJarva({
      message: "trust",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { response: string; jarvaEntryIntent?: string };
    expect(data.response).toContain("Revocable");
    expect(data.jarvaEntryIntent).toBe("trust_general");
  });

  it("returns jarvaWorkflowPath when entry classifies to a specialist lane", async () => {
    const res = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      jarvaWorkflowPath?: string | null;
      jarvaWorkflowPathSource?: string | null;
      jarvaEntryIntent?: string;
    };
    expect(data.jarvaEntryIntent).toBe("trust_revocable");
    expect(data.jarvaWorkflowPath).toBe("trust_revocable");
    expect(data.jarvaWorkflowPathSource).toBe("explicit_turn");
    expect(mockSessionJarvaWorkflowPath).toBe("trust_revocable");
  });

  it("returns jarvaNextUiActionBundle when specialist lane is resolved (portable UI hints)", async () => {
    const res = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      jarvaNextUiActionBundle?: { lane: string | null; actions: Array<{ kind: string }> };
    };
    expect(data.jarvaNextUiActionBundle?.lane).toBe("trust_revocable");
    expect(data.jarvaNextUiActionBundle?.actions.length).toBeGreaterThan(0);
  });

  it("sticky workflow path persists across generic follow-up on the same session", async () => {
    const r1 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as {
      jarvaWorkflowPath: string | null;
      jarvaWorkflowPathSource: string | null;
      sessionId: string;
    };
    expect(d1.jarvaWorkflowPath).toBe("trust_revocable");
    expect(d1.jarvaWorkflowPathSource).toBe("explicit_turn");

    const r2 = await postJarva({
      message: "continue",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const d2 = (await r2.json()) as {
      jarvaWorkflowPath: string | null;
      jarvaWorkflowPathSource: string | null;
    };
    expect(d2.jarvaWorkflowPath).toBe("trust_revocable");
    expect(d2.jarvaWorkflowPathSource).toBe("sticky_session");
  });

  it("explicit later message overrides sticky workflow path", async () => {
    const r1 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as { sessionId: string };
    const r2 = await postJarva({
      message: "Actually we are issuing a corporate bond for the trust.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const d2 = (await r2.json()) as { jarvaWorkflowPath: string | null; jarvaWorkflowPathSource: string | null };
    expect(d2.jarvaWorkflowPath).toBe("trust_bond");
    expect(d2.jarvaWorkflowPathSource).toBe("explicit_turn");
    expect(mockSessionJarvaWorkflowPath).toBe("trust_bond");
  });

  it("trust_general on current message does not clear stored specialist lane", async () => {
    const r1 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as { sessionId: string };
    const r2 = await postJarva({
      message: "trust",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const d2 = (await r2.json()) as {
      jarvaWorkflowPath: string | null;
      jarvaWorkflowPathSource: string | null;
      jarvaEntryIntent?: string;
    };
    expect(d2.jarvaEntryIntent).toBe("trust_general");
    expect(d2.jarvaWorkflowPath).toBe("trust_revocable");
    expect(d2.jarvaWorkflowPathSource).toBe("sticky_session");
  });

  it("prepends procedural banner and appends filtered Jarva appendix to response text", async () => {
    const res = await postJarva({
      message: "grantor: Test",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    const data = (await res.json()) as { response: string };
    expect(data.response).toContain("Trust workflow");
    expect(data.response).toContain("Next questions");
    expect(data.response).toContain("Rule reply");
  });

  it("when procedural step is certificate, response includes certificate-oriented milestone copy", async () => {
    getDbMock.mockImplementation(() => makeChatDb({ withClientSelect: true }) as Awaited<ReturnType<typeof getDb>>);
    const res = await postJarva({
      message: "x",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: {
        trustId: TRUST_ID,
        source: "trust-records",
        clientId: CLIENT_ID,
        workspaceCounts: { parties: 2, assets: 1 },
      },
    });
    const data = (await res.json()) as { response: string; jarvaProceduralStep?: string };
    expect(data.jarvaProceduralStep).toBe("certificate");
    expect(data.response).toContain("Certificate milestone");
    expect(data.response).toContain("Trust Records");
  });

  it("when procedural step is review, response includes review-packet milestone copy", async () => {
    getDbMock.mockImplementation(() => makeChatDb({ withClientSelect: true }) as Awaited<ReturnType<typeof getDb>>);
    const fullExtraction = {
      ...extractionOk,
      intakePatch: {
        ...extractionOk.intakePatch,
        trustName: "TN",
        beneficiariesSummary: "Kids",
        successorTrusteeNote: "Sue",
      },
    };
    extractJarvaIntakeFromChatMock.mockResolvedValueOnce({
      ...fullExtraction,
      fieldKeys: [...fullExtraction.fieldKeys, "trustName", "beneficiariesSummary", "successorTrusteeNote"],
    });
    const res = await postJarva({
      message: "complete intake",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: {
        trustId: TRUST_ID,
        source: "trust-records",
        clientId: CLIENT_ID,
        workspaceCounts: { parties: 2, assets: 1 },
      },
    });
    const data = (await res.json()) as { response: string; jarvaProceduralStep?: string };
    expect(data.jarvaProceduralStep).toBe("review");
    expect(data.response).toContain("Review milestone");
    expect(data.response).toMatch(/DRAFT|not legal advice/i);
  });

  it("lane control: switches sticky lane from revocable to bond via control message", async () => {
    const r1 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as { sessionId: string };
    const r2 = await postJarva({
      message: "__jarva_set_lane__:bond",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    expect(r2.status).toBe(200);
    const d2 = (await r2.json()) as { jarvaWorkflowPath: string | null; jarvaWorkflowPathSource: string | null };
    expect(d2.jarvaWorkflowPath).toBe("trust_bond");
    expect(d2.jarvaWorkflowPathSource).toBe("lane_control");
    expect(mockSessionJarvaWorkflowPath).toBe("trust_bond");
  });

  it("lane control: reset clears sticky workflow path (transcript suppression)", async () => {
    mockSessionJarvaWorkflowPath = "trust_revocable";
    const r = await postJarva({
      message: "__jarva_clear_lane__",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: "lane-reset-session",
    });
    expect(r.status).toBe(200);
    const d = (await r.json()) as { jarvaWorkflowPath: string | null; jarvaWorkflowPathSource: string | null };
    expect(d.jarvaWorkflowPath).toBe(null);
    expect(d.jarvaWorkflowPathSource).toBe("lane_clear");
    expect(mockSessionJarvaWorkflowPath).toBe("__suppress__");
  });

  it("after lane reset, generic follow-up does not read lane from transcript", async () => {
    const r1 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as { sessionId: string };
    await postJarva({
      message: "__jarva_clear_lane__",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const r3 = await postJarva({
      message: "ok",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const d3 = (await r3.json()) as { jarvaWorkflowPath: string | null; jarvaWorkflowPathSource: string | null };
    expect(d3.jarvaWorkflowPath).toBe(null);
    expect(d3.jarvaWorkflowPathSource).toBe(null);
  });

  it("Jarva sync path returns document assembly hints and does not call the DB fallback", async () => {
    const res = await postJarva({
      message: "grantor: Test",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      jarvaDocumentAssemblyHints?: { lines: string[]; ppmDraftReadyForGeneration: boolean };
      jarvaDocumentAssemblyHintsFromFallback?: boolean;
    };
    expect(data.jarvaDocumentAssemblyHints).toBeDefined();
    const hints = data.jarvaDocumentAssemblyHints!;
    expect(typeof hints.ppmDraftReadyForGeneration).toBe("boolean");
    expect(typeof hints.certificatePackageReady).toBe("boolean");
    expect(typeof hints.bondDocumentationReady).toBe("boolean");
    expect(typeof hints.trustReviewPacketReady).toBe("boolean");
    expect(Array.isArray(hints.lines)).toBe(true);
    expect(data.jarvaDocumentAssemblyHintsFromFallback).toBeFalsy();
    expect(computeJarvaDocumentAssemblyHintsFallbackMock).not.toHaveBeenCalled();
  });

  it("when Jarva intake sync is skipped, document assembly hints can come from the fallback", async () => {
    computeJarvaDocumentAssemblyHintsFallbackMock.mockResolvedValueOnce({
      ppmDraftReadyForGeneration: true,
      certificatePackageReady: false,
      bondDocumentationReady: false,
      trustReviewPacketReady: false,
      lines: ["Fallback advisory line for assembly (DRAFT)."],
    });
    const res = await postJarva({
      message: "hello",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      jarvaIntakeSync: false,
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      jarvaDocumentAssemblyHints?: { ppmDraftReadyForGeneration: boolean };
      jarvaDocumentAssemblyHintsFromFallback?: boolean;
      response: string;
    };
    expect(computeJarvaDocumentAssemblyHintsFallbackMock).toHaveBeenCalled();
    expect(data.jarvaDocumentAssemblyHintsFromFallback).toBe(true);
    expect(data.jarvaDocumentAssemblyHints?.ppmDraftReadyForGeneration).toBe(true);
    expect(data.response).toContain("Fallback advisory line");
  });

  it("when sync is skipped and fallback returns null, response omits document assembly hints", async () => {
    computeJarvaDocumentAssemblyHintsFallbackMock.mockResolvedValueOnce(null);
    const res = await postJarva({
      message: "hello",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      jarvaIntakeSync: false,
      context: { trustId: TRUST_ID, source: "trust-records" },
    });
    const data = (await res.json()) as {
      jarvaDocumentAssemblyHints?: unknown;
      jarvaDocumentAssemblyHintsFromFallback?: boolean;
    };
    expect(data.jarvaDocumentAssemblyHints).toBeUndefined();
    expect(data.jarvaDocumentAssemblyHintsFromFallback).toBeUndefined();
  });

  it("explicit message still overrides after lane_control set", async () => {
    const r1 = await postJarva({
      message: "__jarva_set_lane__:trust_bond",
      npcId: "trust-advisor",
      jarvaMode: "assist",
    });
    const d1 = (await r1.json()) as { sessionId: string };
    const r2 = await postJarva({
      message: "We need a revocable living trust for the client.",
      npcId: "trust-advisor",
      jarvaMode: "assist",
      sessionId: d1.sessionId,
    });
    const d2 = (await r2.json()) as { jarvaWorkflowPath: string | null; jarvaWorkflowPathSource: string | null };
    expect(d2.jarvaWorkflowPath).toBe("trust_revocable");
    expect(d2.jarvaWorkflowPathSource).toBe("explicit_turn");
    expect(mockSessionJarvaWorkflowPath).toBe("trust_revocable");
  });

  /**
   * End-to-end-ish sequence: front door → trust keyword → explicit revocable classification → sticky follow-up.
   * Mirrors consultant “open Jarva → trust → revocable → continue drafting” without a browser runner.
   */
  describe("Consultant journey — multi-turn API sequence", () => {
    it("hi → trust (type prompt) → revocable lane → continue keeps sticky drafting lane", async () => {
      const r0 = await postJarva({
        message: "hi",
        npcId: "trust-advisor",
        jarvaMode: "assist",
      });
      const d0 = (await r0.json()) as { sessionId: string; jarvaProceduralStep?: string };
      expect(d0.jarvaProceduralStep).toBe("front_door");

      const r1 = await postJarva({
        message: "trust",
        npcId: "trust-advisor",
        jarvaMode: "assist",
        sessionId: d0.sessionId,
      });
      const d1 = (await r1.json()) as { response: string; jarvaEntryIntent?: string; sessionId: string };
      expect(d1.response).toContain("Revocable");
      expect(d1.jarvaEntryIntent).toBe("trust_general");

      const r2 = await postJarva({
        message: "We need a revocable living trust for the client.",
        npcId: "trust-advisor",
        jarvaMode: "assist",
        sessionId: d1.sessionId,
      });
      const d2 = (await r2.json()) as {
        jarvaWorkflowPath: string | null;
        jarvaWorkflowPathSource?: string | null;
      };
      expect(d2.jarvaWorkflowPath).toBe("trust_revocable");
      expect(d2.jarvaWorkflowPathSource).toBe("explicit_turn");

      const r3 = await postJarva({
        message: "continue with grantor and trustee details",
        npcId: "trust-advisor",
        jarvaMode: "assist",
        sessionId: d1.sessionId,
      });
      const d3 = (await r3.json()) as {
        jarvaWorkflowPath: string | null;
        jarvaWorkflowPathSource?: string | null;
      };
      expect(d3.jarvaWorkflowPath).toBe("trust_revocable");
      expect(d3.jarvaWorkflowPathSource).toBe("sticky_session");
    });
  });
});
