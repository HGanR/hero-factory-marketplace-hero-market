/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { PATCH } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await PATCH(new Request("http://localhost/api/notifications/e1"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found for user", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const limit = jest.fn(async () => []);
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    (getDb as jest.Mock).mockResolvedValue({ select, update: jest.fn() });

    const res = await PATCH(new Request("http://localhost/api/notifications/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("marks read and returns event; idempotent when already read", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);

    const baseRow = {
      id: "e1",
      userId: "9",
      clientId: "",
      trustId: "",
      sourceType: "campaign_reviewer_assignment",
      eventType: "campaign_reviewer_added",
      severity: "info",
      title: "T",
      body: "B",
      eventPayloadJson: { campaignId: "c1" },
      dedupeKey: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      readAt: null as Date | null,
    };

    let selectPass = 0;
    const limit = jest.fn(async () => {
      selectPass++;
      if (selectPass === 1) return [{ ...baseRow }];
      if (selectPass === 2) return [{ ...baseRow, readAt: new Date("2026-01-15T12:00:00.000Z") }];
      return [];
    });
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));

    const updateWhere = jest.fn(() => Promise.resolve());
    const updateSet = jest.fn(() => ({ where: updateWhere }));
    const update = jest.fn(() => ({ set: updateSet }));

    (getDb as jest.Mock).mockResolvedValue({ select, update });

    const res1 = await PATCH(new Request("http://localhost/api/notifications/e1"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res1.status).toBe(200);
    const j1 = (await res1.json()) as { ok: boolean; event: { readAt: string | null } };
    expect(j1.ok).toBe(true);
    expect(j1.event.readAt).toBeTruthy();
    expect(update).toHaveBeenCalled();

    baseRow.readAt = new Date("2026-01-15T12:00:00.000Z");
    selectPass = 0;
    const limit2 = jest.fn(async () => [{ ...baseRow, readAt: new Date("2026-01-15T12:00:00.000Z") }]);
    const where2 = jest.fn(() => ({ limit: limit2 }));
    const from2 = jest.fn(() => ({ where: where2 }));
    const select2 = jest.fn(() => ({ from: from2 }));
    const update2 = jest.fn();
    (getDb as jest.Mock).mockResolvedValue({ select: select2, update: update2 });

    const res2 = await PATCH(new Request("http://localhost/api/notifications/e1"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res2.status).toBe(200);
    expect(update2).not.toHaveBeenCalled();
  });
});
