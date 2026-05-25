/**
 * HTTP-level tests for POST /api/revenue-os/bentley/sync-launch (NextRequest + injected deps).
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { createToken, jwtPayloadIndicatesPlatformAdmin, verifyToken } from "@/lib/auth";
import { handleBentleySyncLaunchPost } from "@/lib/revenue-os/bentley-sync-launch-route-handler";
import type { BentleySyncLaunchPostDeps } from "@/lib/revenue-os/bentley-sync-launch-route-handler";

const TEST_CAMPAIGN_ID = "123e4567-e89b-12d3-a456-426614174000";

function verifyAdminLikeProduction(req: NextRequest): NextResponse | null {
  const token = req.cookies.get("admin-token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "Admin session required (admin-token cookie)." }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload || typeof payload !== "object" || !jwtPayloadIndicatesPlatformAdmin(payload)) {
    return NextResponse.json(
      { error: "Forbidden — platform administrator role required for Content360 platform operations." },
      { status: 403 }
    );
  }
  return null;
}

describe("POST /api/revenue-os/bentley/sync-launch (HTTP)", () => {
  let authUserId: number | null;
  let platformConfigured: boolean;
  const syncInputs: unknown[] = [];

  function deps(): BentleySyncLaunchPostDeps {
    return {
      enforceRevenueOsApiAccess: async () => null,
      getAuthedUserId: async () => authUserId,
      verifyAdminContent360PlatformSchedule: verifyAdminLikeProduction,
      isContent360PlatformConfigured: () => platformConfigured,
      getDb: async () => ({}),
      syncBentleyCampaignPostsAndSchedule: async (_db, input) => {
        syncInputs.push(input);
        return {
          created: 0,
          skipped: 0,
          rescheduled: 0,
          postIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
          requireApproval: false,
        };
      },
    };
  }

  function platformScheduleBody() {
    return {
      campaignId: TEST_CAMPAIGN_ID,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
      content360PlatformSchedule: true,
      publishRoute: "content360",
    };
  }

  beforeEach(() => {
    authUserId = 99;
    platformConfigured = true;
    syncInputs.length = 0;
  });

  it("returns 401 when unauthenticated and body requests content360PlatformSchedule", async () => {
    authUserId = null;
    const req = new NextRequest("http://localhost/api/revenue-os/bentley/sync-launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(platformScheduleBody()),
    });
    const res = await handleBentleySyncLaunchPost(req, deps());
    assert.equal(res.status, 401);
    assert.equal(syncInputs.length, 0);
  });

  it("returns 401 when logged in but not platform admin for content360PlatformSchedule", async () => {
    authUserId = 99;
    const userTok = createToken({ userId: 99, username: "buyer" });
    const req = new NextRequest("http://localhost/api/revenue-os/bentley/sync-launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth-token=${userTok}`,
      },
      body: JSON.stringify(platformScheduleBody()),
    });
    const res = await handleBentleySyncLaunchPost(req, deps());
    assert.equal(res.status, 401);
    const j = (await res.json()) as { error?: string };
    assert.match(String(j.error ?? ""), /Admin session required/i);
    assert.equal(syncInputs.length, 0);
  });

  it("returns 200 when admin session + platform env configured", async () => {
    authUserId = 1;
    const adminTok = createToken({ userId: 1, isAdmin: true, username: "admin" });
    const req = new NextRequest("http://localhost/api/revenue-os/bentley/sync-launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `admin-token=${adminTok}`,
      },
      body: JSON.stringify(platformScheduleBody()),
    });
    const res = await handleBentleySyncLaunchPost(req, deps());
    assert.equal(res.status, 200);
    const j = (await res.json()) as { ok?: boolean; postIds?: string[] };
    assert.equal(j.ok, true);
    assert.equal(Array.isArray(j.postIds), true);
    assert.equal(syncInputs.length, 1);
    const arg = syncInputs[0] as { content360PlatformSchedule?: boolean; userId?: string };
    assert.equal(arg.content360PlatformSchedule, true);
    assert.equal(arg.userId, "1");
  });

  it("returns 400 for invalid scheduleStrategy enum", async () => {
    authUserId = 99;
    const req = new NextRequest("http://localhost/api/revenue-os/bentley/sync-launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: TEST_CAMPAIGN_ID,
        scheduleStrategy: "hourly",
        staggerMinutes: 30,
      }),
    });
    const res = await handleBentleySyncLaunchPost(req, deps());
    assert.equal(res.status, 400);
    const j = (await res.json()) as { error?: string };
    assert.equal(j.error, "INVALID_REQUEST");
    assert.equal(syncInputs.length, 0);
  });

  it("returns 400 when content360PlatformSchedule true but publishRoute is not content360", async () => {
    authUserId = 1;
    const adminTok = createToken({ userId: 1, isAdmin: true, username: "admin" });
    const req = new NextRequest("http://localhost/api/revenue-os/bentley/sync-launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `admin-token=${adminTok}`,
      },
      body: JSON.stringify({
        ...platformScheduleBody(),
        publishRoute: "native",
      }),
    });
    const res = await handleBentleySyncLaunchPost(req, deps());
    assert.equal(res.status, 400);
    const j = (await res.json()) as { error?: string };
    assert.equal(j.error, "INVALID_REQUEST");
    assert.equal(syncInputs.length, 0);
  });
});
