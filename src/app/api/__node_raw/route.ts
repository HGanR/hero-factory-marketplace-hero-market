import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Intentionally zero other imports. If this hangs in production but Edge + `/api/ping-edge` work,
 * the failure is project-level Node serverless (Next/Vercel), not app DB/auth modules.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    node: process.version,
    now: new Date().toISOString(),
  });
}
