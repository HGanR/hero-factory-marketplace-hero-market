import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { syncBentleyLaunchApi } from "@/lib/revenue-os/revenue-os-pipeline-actions";

const validId = "123e4567-e89b-12d3-a456-426614174000";

describe("syncBentleyLaunchApi (request body)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not send content360PlatformSchedule by default", async () => {
    let captured: Record<string, unknown> | null = null;
    globalThis.fetch = mock.fn(async (_url: string | URL, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ok: true,
          created: 0,
          skipped: 0,
          rescheduled: 0,
          postIds: [],
          requireApproval: false,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await syncBentleyLaunchApi({
      campaignId: validId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
    });

    assert.equal(captured?.content360PlatformSchedule, undefined);
    assert.equal(captured?.publishRoute, undefined);
    assert.equal(captured?.campaignId, validId);
    assert.equal(captured?.scheduleStrategy, "staggered");
    assert.equal(captured?.staggerMinutes, 30);
  });

  it("sends content360PlatformSchedule and publishRoute for admin platform scheduling", async () => {
    let captured: Record<string, unknown> | null = null;
    globalThis.fetch = mock.fn(async (_url: string | URL, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ok: true,
          created: 0,
          skipped: 0,
          rescheduled: 0,
          postIds: [],
          requireApproval: false,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await syncBentleyLaunchApi({
      campaignId: validId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
      publishRoute: "content360",
      content360PlatformSchedule: true,
    });

    assert.equal(captured?.content360PlatformSchedule, true);
    assert.equal(captured?.publishRoute, "content360");
  });
});
