/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultLiveSceneStateFromSession, validateLiveSceneState } from "./broadcast-live-scenes";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "@/lib/db";
import {
  getBroadcastLiveSceneState,
  resetBroadcastLiveSceneStateToProgram,
  upsertBroadcastLiveSceneState,
} from "./broadcast-live-scene-store";

describe("broadcast-live-scene-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getBroadcastLiveSceneState returns null when no row", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    await expect(getBroadcastLiveSceneState(99)).resolves.toBeNull();
  });

  it("upsertBroadcastLiveSceneState inserts with onDuplicateKeyUpdate", async () => {
    const onDup = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate: onDup });
    const insert = jest.fn().mockReturnValue({ values });
    (getDb as jest.Mock).mockResolvedValueOnce({ insert });

    const state = getDefaultLiveSceneStateFromSession(
      { id: 3, userId: 7, sceneConfigJson: null, layoutMode: "grid" },
      7
    );
    const v = validateLiveSceneState(state);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await upsertBroadcastLiveSceneState(v.state);
    expect(insert).toHaveBeenCalled();
    expect(onDup).toHaveBeenCalled();
  });

  it("resetBroadcastLiveSceneStateToProgram deletes row", async () => {
    const delMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    (getDb as jest.Mock).mockResolvedValueOnce({ delete: delMock });
    await resetBroadcastLiveSceneStateToProgram(4);
    expect(delMock).toHaveBeenCalled();
  });
});
