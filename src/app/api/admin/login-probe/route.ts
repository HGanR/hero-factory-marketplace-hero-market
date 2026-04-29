/**
 * Zero heavy imports: use to see if the Node function can return at all
 * for POST /api/admin/login-probe (isolates "import chain" vs "handler body").
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({
    ok: true,
    step: "login-probe",
    message: "minimal route; no db/auth/schema imports in this file",
    timestamp: new Date().toISOString(),
  });
}
