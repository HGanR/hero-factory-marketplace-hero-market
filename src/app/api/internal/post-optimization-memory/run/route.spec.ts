/**
 * @jest-environment node
 */

import { POST } from "@/app/api/internal/post-optimization-memory/run/route";

describe("POST /api/internal/post-optimization-memory/run", () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it("returns 401 without worker secret", async () => {
    delete process.env.SCHEDULED_PUBLISH_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost/api/internal/post-optimization-memory/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });
});
