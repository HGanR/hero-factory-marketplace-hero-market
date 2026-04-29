/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultOverlayState, validateBroadcastOverlayState } from "./broadcast-overlays";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "@/lib/db";
import {
  getBroadcastOverlayState,
  resetBroadcastOverlayState,
  upsertBroadcastOverlayState,
} from "./broadcast-overlay-store";

describe("broadcast-overlay-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getBroadcastOverlayState returns null when no row", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    await expect(getBroadcastOverlayState(3)).resolves.toBeNull();
  });

  it("upsertBroadcastOverlayState uses drizzle chain", async () => {
    const onDup = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate: onDup });
    const insert = jest.fn().mockReturnValue({ values });
    (getDb as jest.Mock).mockResolvedValueOnce({ insert });

    const state = getDefaultOverlayState(2, 8);
    const v = validateBroadcastOverlayState(state);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await upsertBroadcastOverlayState(v.state);
    expect(insert).toHaveBeenCalled();
    expect(onDup).toHaveBeenCalled();
  });

  it("resetBroadcastOverlayState deletes", async () => {
    const delMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    (getDb as jest.Mock).mockResolvedValueOnce({ delete: delMock });
    await resetBroadcastOverlayState(5);
    expect(delMock).toHaveBeenCalled();
  });
});
