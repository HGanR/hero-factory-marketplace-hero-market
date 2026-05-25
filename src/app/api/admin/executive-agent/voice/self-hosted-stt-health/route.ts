import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getSelfHostedSttHealthReport } from "@/lib/voices/self-hosted-stt-health";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await getSelfHostedSttHealthReport();
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "HEALTH_FAILED", message: msg }, { status: 500 });
  }
}
