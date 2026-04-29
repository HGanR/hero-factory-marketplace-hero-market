/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(async () => 100),
}));

jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-auto-directing-engine", () => ({
  evaluateBroadcastAutoDirectingForSession: jest.fn(async () => {}),
  applyBroadcastAutoDirectingRecommendationManual: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => ({
  getBroadcastAutoDirectingState: jest.fn(),
  ensureBroadcastAutoDirectingStateForSession: jest.fn(),
  upsertBroadcastAutoDirectingState: jest.fn(async () => {}),
  buildAutoDirectingPublicSummary: jest.requireActual("@/lib/meet/broadcast-auto-directing-store")
    .buildAutoDirectingPublicSummary,
}));

jest.mock("@/lib/meet/broadcast-metrics", () => ({
  incrementBroadcastAutoDirectingChange: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-audit", () => ({
  broadcastAudit: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-event-publisher", () => ({
  publishAutoDirectingUpdated: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { getDb } from "@/lib/db";
import {
  getBroadcastAutoDirectingState,
  ensureBroadcastAutoDirectingStateForSession,
} from "@/lib/meet/broadcast-auto-directing-store";
import { incrementBroadcastAutoDirectingChange } from "@/lib/meet/broadcast-metrics";
import { publishAutoDirectingUpdated } from "@/lib/meet/broadcast-event-publisher";
import { applyBroadcastAutoDirectingRecommendationManual } from "@/lib/meet/broadcast-auto-directing-engine";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

function v2Session(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    userId: 100,
    roomId: "r1",
    status: "active",
    layoutMode: "grid",
    sceneConfigJson: null,
    compositorMode: "v2_rendered_template",
    renderSessionId: 1,
    compositorFallbackFromV2: false,
    ...overrides,
  };
}

function dbMockForSession(session: unknown | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(session ? [session] : []),
        }),
      }),
    }),
  };
}

describe("/api/meet/broadcast/auto-directing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthedUserId as jest.Mock).mockResolvedValue(100);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValue({ ok: true });
  });

  it("GET returns 401 when unauthenticated", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { code?: string; ok?: boolean };
    expect(j.ok).toBe(false);
    expect(j.code).toBe(BROADCAST_CODES.notAuthenticated);
  });

  it("GET returns 400 for invalid broadcastSessionId", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("GET returns 404 session_not_found", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(null));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingSessionNotFound);
  });

  it("GET returns 403 host_mismatch when session owned by another user", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session({ userId: 999 })));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingHostMismatch);
  });

  it("GET returns 409 not_active when session ended", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session({ status: "ended" })));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingNotActive);
  });

  it("GET returns 409 not_supported for V1 compositor", async () => {
    (getDb as jest.Mock).mockResolvedValue(
      dbMockForSession(v2Session({ compositorMode: "v1_livekit_default", renderSessionId: null }))
    );
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingNotSupported);
  });

  it("GET returns stable shape on success", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const pol = getDefaultBroadcastAutoDirectingPolicy();
    pol.mode = "suggest_only";
    const persisted = {
      policy: pol,
      lastDecision: {
        recommendedLayoutMode: "speaker" as const,
        reason: "test_reason",
        confidence: "medium" as const,
        shouldApply: true,
      },
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    };
    (getBroadcastAutoDirectingState as jest.Mock).mockResolvedValue(persisted);
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      summary: { mode: string; latestRecommendedLayout: string | null };
      policy: typeof pol;
      lastDecision: unknown;
      manualOverrideActive: boolean;
    };
    expect(j.ok).toBe(true);
    expect(j.summary.mode).toBe("suggest_only");
    expect(j.summary.latestRecommendedLayout).toBe("speaker");
    expect(j.policy.mode).toBe("suggest_only");
    expect(j.manualOverrideActive).toBe(false);
    expect(Object.keys(j).sort()).toEqual(
      [
        "lastAppliedAt",
        "lastDecision",
        "manualOverrideActive",
        "manualOverrideUntilIso",
        "ok",
        "policy",
        "summary",
      ].sort()
    );
  });

  it("POST returns 401 when unauthenticated", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, mode: "off" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.notAuthenticated);
  });

  it("POST returns 400 invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("POST returns 400 when broadcastSessionId missing", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ mode: "off" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("POST returns 400 for invalid policy mode", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const base = {
      policy: getDefaultBroadcastAutoDirectingPolicy(),
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    };
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockResolvedValue(base);
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, mode: "turbo_ai" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("POST updates mode and emits change metric + realtime", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const base = {
      policy: getDefaultBroadcastAutoDirectingPolicy(),
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    };
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockResolvedValue({ ...base });
    (getBroadcastAutoDirectingState as jest.Mock).mockResolvedValue({
      ...base,
      policy: { ...base.policy, mode: "auto_apply" as const },
    });

    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, mode: "auto_apply" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; policy: { mode: string } };
    expect(j.ok).toBe(true);
    expect(j.policy.mode).toBe("auto_apply");
    expect(incrementBroadcastAutoDirectingChange).toHaveBeenCalled();
    expect(publishAutoDirectingUpdated).toHaveBeenCalledWith(55, "r1", expect.objectContaining({ settings: true }));
  });

  it("POST clears manual override when manualOverrideUntilIso null", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const base = {
      policy: getDefaultBroadcastAutoDirectingPolicy(),
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: "2099-01-01T00:00:00.000Z",
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    };
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockResolvedValue({ ...base });
    (getBroadcastAutoDirectingState as jest.Mock).mockImplementation(async () => ({
      ...base,
      manualOverrideUntilIso: null,
    }));

    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, manualOverrideUntilIso: null }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { manualOverrideActive: boolean }).manualOverrideActive).toBe(false);
  });

  it("POST applyRecommendedNow returns 400 when manual apply fails", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const base = {
      policy: getDefaultBroadcastAutoDirectingPolicy(),
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    };
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockResolvedValue({ ...base });
    (getBroadcastAutoDirectingState as jest.Mock).mockResolvedValue({ ...base });
    (applyBroadcastAutoDirectingRecommendationManual as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: "no_recommendation",
    });

    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, applyRecommendedNow: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("POST returns host wallet failure from assertMeetBroadcastHost", async () => {
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      code: BROADCAST_CODES.hostMismatch,
      error: "wallet mismatch",
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, hostWallet: "0xbad" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.hostMismatch);
  });
});
