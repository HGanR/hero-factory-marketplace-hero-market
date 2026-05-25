import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bentleySyncLaunchBodySchema } from "@/lib/revenue-os/bentley-sync-launch-body";
import type { ScheduleStrategy } from "@/lib/revenue-os/bentley-sync-launch-plan";
import type {
  SyncBentleyLaunchInput,
  SyncBentleyLaunchResult,
} from "@/lib/revenue-os/bentley-sync-launch-server";

/**
 * Injectable collaborators for POST /api/revenue-os/bentley/sync-launch (keeps the handler testable
 * without loading `server-only` admin / platform env modules in node:test).
 */
export type BentleySyncLaunchPostDeps = {
  enforceRevenueOsApiAccess: (req: NextRequest) => Promise<NextResponse | null>;
  getAuthedUserId: () => Promise<number | null>;
  /** Return a JSON error response when the session cannot use platform scheduling; otherwise null. */
  verifyAdminContent360PlatformSchedule: (req: NextRequest) => NextResponse | null;
  isContent360PlatformConfigured: () => boolean;
  getDb: () => Promise<unknown>;
  syncBentleyCampaignPostsAndSchedule: (
    db: unknown,
    input: SyncBentleyLaunchInput
  ) => Promise<SyncBentleyLaunchResult>;
};

/**
 * POST /api/revenue-os/bentley/sync-launch — shared implementation for the route and HTTP tests.
 */
export async function handleBentleySyncLaunchPost(
  req: NextRequest,
  deps: BentleySyncLaunchPostDeps
): Promise<NextResponse> {
  const __rosGate = await deps.enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await deps.getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bentleySyncLaunchBodySchema.parse(body);

    if (parsed.content360PlatformSchedule === true) {
      const adminBlock = deps.verifyAdminContent360PlatformSchedule(req);
      if (adminBlock) return adminBlock;
      if (!deps.isContent360PlatformConfigured()) {
        return NextResponse.json(
          {
            error: "CONTENT360_PLATFORM_NOT_CONFIGURED",
            message:
              "content360PlatformSchedule requires CONTENT360_BASE_URL (or CONTENT360_API_BASE) and CONTENT360_API_KEY (or CONTENT360_PLATFORM_API_KEY).",
          },
          { status: 400 },
        );
      }
    }

    const db = await deps.getDb();

    const result = await deps.syncBentleyCampaignPostsAndSchedule(db, {
      userId: String(userId),
      campaignId: parsed.campaignId,
      scheduleStrategy: parsed.scheduleStrategy as ScheduleStrategy,
      staggerMinutes: parsed.staggerMinutes,
      content360PlatformSchedule: parsed.content360PlatformSchedule === true,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid payload", issues: e.flatten() },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[revenue-os/bentley/sync-launch]", msg);
    return NextResponse.json({ error: "SYNC_FAILED", message: msg }, { status: 500 });
  }
}
