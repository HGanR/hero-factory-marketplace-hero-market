/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultBroadcastScheduleState, validateBroadcastScheduleState } from "./broadcast-schedule";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "@/lib/db";
import {
  getBroadcastScheduleState,
  resetBroadcastScheduleState,
  upsertBroadcastScheduleState,
} from "./broadcast-schedule-store";

describe("broadcast-schedule-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getBroadcastScheduleState returns null when no row", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    await expect(getBroadcastScheduleState(99)).resolves.toBeNull();
  });

  it("upsertBroadcastScheduleState calls insert with onDuplicateKeyUpdate", async () => {
    const onDup = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate: onDup });
    const insert = jest.fn().mockReturnValue({ values });
    (getDb as jest.Mock).mockResolvedValueOnce({ insert });

    const state = getDefaultBroadcastScheduleState(3, 7);
    const v = validateBroadcastScheduleState(state);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await upsertBroadcastScheduleState(v.state);
    expect(insert).toHaveBeenCalled();
    expect(onDup).toHaveBeenCalled();
  });

  it("resetBroadcastScheduleState deletes row", async () => {
    const delMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    (getDb as jest.Mock).mockResolvedValueOnce({ delete: delMock });
    await resetBroadcastScheduleState(4);
    expect(delMock).toHaveBeenCalled();
  });
});
