/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/revenue-os/bentley-correlation-server", () => ({
  logBentleyCorrelationEvent: jest.fn(),
}));
jest.mock("@/lib/revenue-os/launch-progress-db", () => ({
  loadLatestLaunchCycleForUser: jest.fn(async () => null),
  listLaunchCyclesForUser: jest.fn(async () => []),
  listLaunchCycleEventsForUser: jest.fn(async () => []),
  createLaunchCycleForUser: jest.fn(),
  saveLaunchCycleProgressForUser: jest.fn(),
}));

describe("/api/revenue-os/launch-cycle", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
  });

  it("GET returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValueOnce(null);
    const req = new NextRequest(
      "http://localhost/api/revenue-os/launch-cycle?scopeKey=revenue-os%3Alaunch-cycle-progress-v1"
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/revenue-os/launch-cycle", {
      method: "POST",
      body: JSON.stringify({
        scopeKey: "revenue-os:launch-cycle-progress-v1",
        progress: { invalid: true },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
