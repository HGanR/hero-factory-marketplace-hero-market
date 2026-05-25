import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveSkipperRuntimeDiagnostics } from "@/lib/executive-agent/executive-skipper-runtime-diagnostics";

export const dynamic = "force-dynamic";

/**
 * Admin diagnostics: SKIPPER AI Agency identity + assigned voice + self-hosted health + orchestrator wiring.
 * Response shape is stable for dashboards; never includes API keys.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const payload = await buildExecutiveSkipperRuntimeDiagnostics(db, adminUserId);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "DIAGNOSTICS_FAILED", message: msg }, { status: 500 });
  }
}
