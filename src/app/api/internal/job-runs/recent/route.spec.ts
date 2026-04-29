/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import * as cronAuth from "@/lib/social/internal-worker-cron-auth";
import * as jobRunMod from "@/lib/revenue-os/internal-batch-job-run";

jest.mock("@/lib/db");
jest.mock("@/lib/api/auth");
jest.mock("@/lib/social/internal-worker-cron-auth");

describe("GET /api/internal/job-runs/recent", () => {
  let listSpy: jest.SpiedFunction<typeof jobRunMod.listRecentInternalJobRuns>;

  beforeEach(() => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReset();
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    listSpy = jest.spyOn(jobRunMod, "listRecentInternalJobRuns");
  });

  afterEach(() => {
    listSpy.mockRestore();
  });

  it("returns 401 when unauthorized", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(false);
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/internal/job-runs/recent"));
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
  });

  it("returns runs when internal cron authorized", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(true);
    (getDb as jest.Mock).mockResolvedValue({});
    const started = new Date("2026-04-01T00:00:00.000Z");
    listSpy.mockResolvedValue([
      {
        id: "id1",
        jobType: "publish_approval_sla_scan_all",
        startedAt: started,
        finishedAt: started,
        status: "success",
        summaryJson: { campaignsScanned: 1 },
        errorCount: 0,
        createdAt: started,
      },
    ]);

    const res = await GET(
      new NextRequest("http://localhost/api/internal/job-runs/recent?limit=5", {
        headers: { "x-cron-secret": "x" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; runs?: { id: string }[] };
    expect(j.ok).toBe(true);
    expect(j.runs?.[0]?.id).toBe("id1");
  });
});
