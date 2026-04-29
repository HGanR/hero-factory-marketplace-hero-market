import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("@/lib/social/internal-scheduled-publish-auth", () => ({
  isAuthorizedScheduledPublishRequest: jest.fn(() => true),
}));

jest.mock("@/lib/social/run-due-scheduled-publishes", () => ({
  runDueScheduledPublishes: jest.fn(async () => ({
    scanned: 1,
    attempted: 0,
    published: 0,
    retried: 0,
    failed: 0,
    skipped: 1,
    skippedAwaitingApproval: 1,
  })),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(async () => ({
    insert: () => ({ values: async () => {} }),
  })),
}));

describe("POST /api/internal/social/publish-run", () => {
  beforeEach(() => {
    process.env.SCHEDULED_PUBLISH_WORKER_SECRET = "test-secret";
  });

  it("returns normalized job payload shape", async () => {
    const req = new NextRequest("http://localhost/api/internal/social/publish-run", {
      method: "POST",
      headers: { "x-cron-secret": "test-secret" },
      body: JSON.stringify({ limit: 5 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      jobType: string;
      startedAt: string;
      finishedAt: string;
      durationMs: number;
      summary: Record<string, unknown>;
    };
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("social_publish_run");
    expect(typeof j.durationMs).toBe("number");
    expect(j.summary.skippedAwaitingApproval).toBe(1);
  });
});
