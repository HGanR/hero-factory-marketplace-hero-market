import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Deployment marker only — no DB, drizzle, or auth. If this JSON is not returned, the new deploy is not live.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    marker: "diag-v2-no-imports",
    timestamp: new Date().toISOString(),
  });
}
