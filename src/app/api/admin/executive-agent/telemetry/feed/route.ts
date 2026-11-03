import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  handleTelemetryFeedGet,
  listTelemetryEventsFromDb,
} from "./telemetry-feed-route-handler";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/telemetry/feed — STEP 1 telemetry event feed (Option A). */
export async function GET(req: NextRequest) {
  return handleTelemetryFeedGet(req, {
    getExecutiveAdminUserId,
    getDb,
    tools: { listTelemetryEvents: listTelemetryEventsFromDb },
  });
}
