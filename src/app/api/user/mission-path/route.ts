import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { buildUserMissionPathResponse } from "@/lib/user-mission-path/build-mission-path-response";
import { queryMissionPathPrerequisites } from "@/lib/user-mission-path/query-mission-path-prereqs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pre = await queryMissionPathPrerequisites(userId);
    return NextResponse.json(buildUserMissionPathResponse(pre));
  } catch (e) {
    console.error("[mission-path] GET", e);
    return NextResponse.json({ error: "Failed to load mission path" }, { status: 500 });
  }
}
