/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { GET, POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { listScenePresets, createScenePreset } from "@/lib/meet/broadcast-scene-presets";
import { getDefaultSceneConfig } from "@/lib/meet/broadcast-scene";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-scene-presets", () => ({
  listScenePresets: jest.fn(),
  createScenePreset: jest.fn(),
}));

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockList = listScenePresets as jest.MockedFunction<typeof listScenePresets>;
const mockCreate = createScenePreset as jest.MockedFunction<typeof createScenePreset>;

describe("/api/meet/broadcast/scene-presets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns presets", async () => {
    mockUser.mockResolvedValueOnce(3);
    const now = new Date();
    mockList.mockResolvedValueOnce([
      {
        id: 1,
        userId: 3,
        name: "A",
        configJson: getDefaultSceneConfig() as never,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      } as never,
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { presets: { id: number }[] };
    expect(body.presets[0].id).toBe(1);
  });

  it("POST creates preset", async () => {
    mockUser.mockResolvedValueOnce(3);
    const now = new Date();
    mockCreate.mockResolvedValueOnce({
      id: 2,
      userId: 3,
      name: "B",
      configJson: getDefaultSceneConfig() as never,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    } as never);
    const res = await POST(
      new Request("http://localhost/api/meet/broadcast/scene-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "B", config: getDefaultSceneConfig() }),
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });
});
