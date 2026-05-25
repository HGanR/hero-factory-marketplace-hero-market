import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getSelfHostedTtsHealthReport } from "@/lib/voices/self-hosted-tts-health";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await getSelfHostedTtsHealthReport();
    return NextResponse.json(
      {
        configured: report.configured,
        enabled: report.enabled,
        baseUrlPresent: report.baseUrlPresent,
        reachable: report.reachable,
        createEndpointKnown: report.createEndpointKnown,
        speakEndpointKnown: report.speakEndpointKnown,
        message: report.message,
        uiLabel: report.uiLabel,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "HEALTH_FAILED", message: msg }, { status: 500 });
  }
}
