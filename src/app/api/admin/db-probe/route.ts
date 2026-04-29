import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Temporary Edge handler: proves route path + deploy. If this works but Node routes hang,
 * the issue is Node serverless (App Router or whole project), not routing.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    marker: "db-probe-edge-v1",
    timestamp: new Date().toISOString(),
    runtime: "edge",
    hint: "Node smoke: GET /api/node-pages-smoke — staged DB (Node): /api/admin/diag-db?probeDb=1",
  });
}
