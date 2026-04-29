import { NextRequest, NextResponse } from "next/server";
import { resolveNpcAdminSession } from "@/lib/admin/require-npc-admin";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await resolveNpcAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      isAdmin: true,
      username: session.username,
    });
  } catch (error) {
    console.error("Admin check error:", error);
    return NextResponse.json({ error: "Admin check failed" }, { status: 500 });
  }
}







