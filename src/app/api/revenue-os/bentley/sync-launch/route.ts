import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { requireAdminContent360Session, Content360AdminAuthError } from "@/lib/auth/require-admin-content360";
import { isContent360PlatformConfigured } from "@/lib/content360/content360-platform-env";
import {
  handleBentleySyncLaunchPost,
  type BentleySyncLaunchPostDeps,
} from "@/lib/revenue-os/bentley-sync-launch-route-handler";

const bentleySyncLaunchPostDeps: BentleySyncLaunchPostDeps = {
  enforceRevenueOsApiAccess,
  getAuthedUserId,
  verifyAdminContent360PlatformSchedule(req) {
    try {
      requireAdminContent360Session(req);
      return null;
    } catch (e) {
      if (e instanceof Content360AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  },
  isContent360PlatformConfigured,
  getDb,
  syncBentleyCampaignPostsAndSchedule,
};

/**
 * POST /api/revenue-os/bentley/sync-launch
 * Idempotent: creates missing campaign_posts from `bentley_generation_json`, applies schedule + approval UTM.
 */
export async function POST(req: NextRequest) {
  return handleBentleySyncLaunchPost(req, bentleySyncLaunchPostDeps);
}
