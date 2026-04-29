/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const logClientPortalActivity = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/client-portal/portal-activity", () => ({
  logClientPortalActivity,
}));
jest.mock("@/lib/db/client-portal-ensure", () => ({
  ensureClientPortalTables: jest.fn().mockResolvedValue(undefined),
}));

let currentRow: any = null;
let selectCall = 0;
const getDb = jest.fn(async () => ({
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          selectCall += 1;
          if (selectCall <= 2) return [currentRow];
          return [{ ...currentRow }];
        },
      }),
    }),
  }),
  update: () => ({
    set: (v: Record<string, unknown>) => ({
      where: async () => {
        currentRow = { ...currentRow, ...v };
      },
    }),
  }),
}));
jest.mock("@/lib/db", () => ({ getDb }));

describe("updateOperatorRequestStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectCall = 0;
    currentRow = {
      id: "r1",
      clientId: "c1",
      ownerUserId: 9,
      status: "open",
      operatorNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  it("logs activity when status changes", async () => {
    const { updateOperatorRequestStatus } = await import("./portal-requests");
    const out = await updateOperatorRequestStatus(9, "c1", "r1", { status: "reviewing", operatorNote: "checking" });
    expect(out?.status).toBe("reviewing");
    expect(logClientPortalActivity).toHaveBeenCalledWith(
      "c1",
      null,
      "request_status_updated",
      expect.objectContaining({ requestId: "r1", from: "open", to: "reviewing" }),
    );
  });
});
