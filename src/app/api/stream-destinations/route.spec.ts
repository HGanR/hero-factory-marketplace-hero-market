/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED } from "@/lib/streaming/destinations";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

function chainSelectEmpty() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
        }),
      }),
    }),
  };
}

describe("GET /api/stream-destinations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("includes encryptionConfigured false when env key missing", async () => {
    const prev = process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    delete process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    mockUser.mockResolvedValueOnce(1);
    mockGetDb.mockResolvedValueOnce(chainSelectEmpty() as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const j = (await res.json()) as { encryptionConfigured?: boolean; destinations?: unknown[] };
    expect(j.encryptionConfigured).toBe(false);
    expect(Array.isArray(j.destinations)).toBe(true);
    if (prev !== undefined) process.env.STREAM_DESTINATION_ENCRYPTION_KEY = prev;
  });

  it("includes encryptionConfigured true when env key set", async () => {
    const prev = process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    process.env.STREAM_DESTINATION_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64");
    mockUser.mockResolvedValueOnce(1);
    mockGetDb.mockResolvedValueOnce(chainSelectEmpty() as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const j = (await res.json()) as { encryptionConfigured?: boolean };
    expect(j.encryptionConfigured).toBe(true);
    if (prev !== undefined) process.env.STREAM_DESTINATION_ENCRYPTION_KEY = prev;
    else delete process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
  });
});

describe("POST /api/stream-destinations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 503 with stable code when encryption not configured", async () => {
    const prev = process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    delete process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    mockUser.mockResolvedValueOnce(1);
    const req = new NextRequest("http://localhost/api/stream-destinations", {
      method: "POST",
      body: JSON.stringify({ platform: "twitch", streamKey: "live_abc", label: "Main" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const j = (await res.json()) as { code?: string; error?: string };
    expect(j.code).toBe(STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED);
    expect(j.error).toMatch(/STREAM_DESTINATION_ENCRYPTION_KEY/);
    expect(mockGetDb).not.toHaveBeenCalled();
    if (prev !== undefined) process.env.STREAM_DESTINATION_ENCRYPTION_KEY = prev;
  });
});

describe("PATCH /api/stream-destinations/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 503 with stable code when encryption not configured", async () => {
    const prev = process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    delete process.env.STREAM_DESTINATION_ENCRYPTION_KEY;
    mockUser.mockResolvedValueOnce(1);
    const req = new NextRequest("http://localhost/api/stream-destinations/1", {
      method: "PATCH",
      body: JSON.stringify({ label: "x" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(503);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED);
    expect(mockGetDb).not.toHaveBeenCalled();
    if (prev !== undefined) process.env.STREAM_DESTINATION_ENCRYPTION_KEY = prev;
  });
});
